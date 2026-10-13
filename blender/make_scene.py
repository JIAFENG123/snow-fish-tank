"""Snow-fish-tank scene decor for Three.js.

Run headless:
  blender -b --factory-startup -P blender/make_scene.py -- --glb public/scene.glb [--render preview.png]

Coordinate system (Blender, Z up):
  glTF export converts (x, y, z) -> (x, z, -y), so Blender +Y depth becomes Three.js -Z.

Contents (world units == Three.js units), all INSIDE the tank:
  snow_bed      snow ground (tank inner floor at z = 0.10)
  rock_0..5     snow-capped rocks
  wood_0/1      driftwood branches
  pebble_*      small pebbles
"""

import bpy
import bmesh
import math
import random
import sys
import os
import traceback
from mathutils import Vector, Matrix, noise

# ---------------------------------------------------------------- scene reset

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
             bpy.data.curves, bpy.data.lights, bpy.data.cameras):
    for block in list(coll):
        try:
            coll.remove(block)
        except Exception:
            pass

random.seed(20260101)

# ---------------------------------------------------------------- materials

def principled(name, color, rough=0.8, metal=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return mat


MAT_SNOW = principled("snow", (0.84, 0.87, 0.94), 0.85)
MAT_ROCK = principled("rock", (0.19, 0.18, 0.19), 0.92)
MAT_ROCK_DK = principled("rock_dark", (0.15, 0.14, 0.15), 0.92)
MAT_WOOD = principled("driftwood", (0.23, 0.14, 0.07), 0.88)
MAT_PEBBLE = principled("pebble", (0.36, 0.34, 0.33), 0.85)

# ---------------------------------------------------------------- helpers

def obj_from_bm(name, bm, mat=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def apply_rot_scale(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def fbm(x, y, seed, octaves=4, freq=0.35):
    total = 0.0
    amp = 1.0
    f = freq
    norm = 0.0
    for i in range(octaves):
        total += noise.noise(Vector((x * f, y * f, seed + i * 13.7))) * amp
        norm += amp
        amp *= 0.5
        f *= 2.0
    return total / norm  # roughly -1..1


def cone2_bm(bm, r1, r2, depth, M, segments=10):
    """Tapered cone, radius1 at local -Z end, radius2 at +Z end."""
    try:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments,
                              radius1=r1, radius2=r2, depth=depth, matrix=M)
    except TypeError:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments,
                              diameter1=r1 * 2, diameter2=r2 * 2,
                              depth=depth, matrix=M)


def align_matrix(p1, p2):
    """Local Z along p1->p2, centered between the two points."""
    d = p2 - p1
    z = d.normalized()
    x = Vector((1, 0, 0))
    x = x - z * x.dot(z)
    if x.length < 1e-6:
        x = Vector((0, 1, 0)) - z * Vector((0, 1, 0)).dot(z)
    x.normalize()
    y = z.cross(x)
    rot = Matrix((x, y, z)).transposed().to_4x4()
    return Matrix.Translation((p1 + p2) / 2) @ rot


def cap_snow(ob, threshold):
    """Assign snow material to upward-facing polygons."""
    ob.data.materials.append(MAT_SNOW)
    snow_idx = len(ob.data.materials) - 1
    for p in ob.data.polygons:
        if p.normal.z > threshold:
            p.material_index = snow_idx


# ---------------------------------------------------------------- snow terrain

def snow_terrain(name, hx, hy, segs, amp, seed, base_z=0.0, flat_hx=0.0, flat_hy=0.0, ramp=1.5):
    """Grid terrain, heights in [0, amp], flattened to 0 inside (flat_hx, flat_hy)."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=segs, y_segments=segs, size=1.0)
    for v in bm.verts:
        x = v.co.x * hx
        y = v.co.y * hy
        dx = max(abs(x) - flat_hx, 0.0)
        dy = max(abs(y) - flat_hy, 0.0)
        d = math.hypot(dx, dy)
        t = min(d / ramp, 1.0)
        t = t * t * (3.0 - 2.0 * t)  # smoothstep
        h = (fbm(x, y, seed) * 0.5 + 0.5) * amp * t
        v.co = Vector((x, y, h))
    ob = obj_from_bm(name, bm, MAT_SNOW)
    ob.location.z = base_z
    smooth(ob)
    return ob


snow_terrain("snow_bed", 2.95, 1.75, 64, 0.22, seed=41.0, base_z=0.095)

# ---------------------------------------------------------------- rocks

def make_rock(name, loc, scale, seed, base_mat=MAT_ROCK, snow_line=0.74):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
    off = Vector((seed * 3.1, seed * 1.7, seed * 2.3))
    for v in bm.verts:
        n = v.co.normalized()
        d = noise.noise(v.co * 1.5 + off)
        v.co += n * d * 0.38
        d2 = noise.noise(v.co * 4.0 + off * 2.0)
        v.co += n * d2 * 0.12
    ob = obj_from_bm(name, bm, base_mat)
    ob.scale = scale
    ob.rotation_euler = (0, 0, random.uniform(0, math.tau))
    ob.location = loc
    apply_rot_scale(ob)
    smooth(ob)
    cap_snow(ob, snow_line)
    return ob


# interior rocks: (name, x, y, sx, sy, sz, seed)
IN_ROCKS = [
    ("rock_0", -1.70, 0.60, 0.64, 0.52, 0.50, 11.0),
    ("rock_1", -1.20, 1.05, 0.40, 0.35, 0.31, 12.0),
    ("rock_2", 1.60, -0.80, 0.70, 0.58, 0.54, 13.0),
    ("rock_3", 2.15, -0.30, 0.35, 0.31, 0.28, 14.0),
    ("rock_4", 0.30, -1.20, 0.51, 0.42, 0.36, 15.0),
    ("rock_5", -0.45, 1.30, 0.28, 0.25, 0.22, 16.0),
]
for nm, x, y, sx, sy, sz, sd in IN_ROCKS:
    z = 0.17 - sz * 0.18  # partially buried in the snow bed
    make_rock(nm, (x, y, z), (sx, sy, sz), sd, snow_line=0.82)

# ---------------------------------------------------------------- driftwood

def make_driftwood(name, p0, p1, r0, r1, seed, twigs=3):
    """Main tapered branch from p0 to p1 with a few upward child twigs."""
    rnd = random.Random(seed)
    bm = bmesh.new()

    def seg(a, b, ra, rb, segs=9):
        cone2_bm(bm, ra, rb, (b - a).length, align_matrix(a, b), segments=segs)

    seg(Vector(p0), Vector(p1), r0, r1)

    main_dir = (Vector(p1) - Vector(p0)).normalized()
    for i in range(twigs):
        t = rnd.uniform(0.3, 0.85)
        start = Vector(p0).lerp(Vector(p1), t)
        rr = r0 + (r1 - r0) * t
        # random direction with upward bias
        ang = rnd.uniform(0, math.tau)
        up = rnd.uniform(0.35, 0.95)
        side = math.sqrt(max(1.0 - up * up, 0.0))
        d = Vector((math.cos(ang) * side, math.sin(ang) * side, up))
        d = (d + main_dir * rnd.uniform(-0.3, 0.4)).normalized()
        ln = rnd.uniform(0.3, 0.7)
        seg(start, start + d * ln, rr * 0.55, rr * 0.18, segs=7)

    # gnarl the whole thing
    off = Vector((seed * 0.9, seed * 1.3, seed * 0.6))
    for v in bm.verts:
        n = v.co.normalized()
        v.co += n * noise.noise(v.co * 7.0 + off) * 0.02

    ob = obj_from_bm(name, bm, MAT_WOOD)
    smooth(ob)
    cap_snow(ob, 0.72)
    return ob


make_driftwood("wood_0", (-2.35, -0.95, 0.30), (0.95, 0.62, 0.85), 0.105, 0.055, seed=3.0, twigs=5)
make_driftwood("wood_1", (1.15, 1.10, 0.26), (2.45, 0.72, 0.34), 0.095, 0.070, seed=8.0, twigs=2)

# ---------------------------------------------------------------- pebbles

for i in range(16):
    x = random.uniform(-2.7, 2.7)
    y = random.uniform(-1.55, 1.55)
    r = random.uniform(0.05, 0.115)
    make_rock(f"pebble_{i}", (x, y, 0.115 - r * 0.35), (r, r * random.uniform(0.8, 1.0), r * 0.8),
              seed=100.0 + i, base_mat=MAT_PEBBLE, snow_line=0.7)

# ---------------------------------------------------------------- export / render

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
args = dict(zip(argv[::2], argv[1::2]))

glb_path = args.get("--glb", os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                           "..", "public", "scene.glb"))
os.makedirs(os.path.dirname(os.path.abspath(glb_path)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", export_apply=True)
print("EXPORTED:", os.path.abspath(glb_path))

render_path = args.get("--render")
if render_path:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 40
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (7.5, -8.5, 5.5)
    direction = Vector((0, 0, 0.5)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 4.0
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("sun", sun_data)
    bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))

    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.65, 0.78, 1)
    scene.world = world

    scene.render.filepath = render_path
    bpy.ops.render.render(write_still=True)
    print("RENDERED:", render_path)

print("DONE")
