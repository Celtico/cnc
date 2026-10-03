"""Herba de Poly Haven (grass_medium_01, .blend amb les mates en LOD0/1/2) per a l'app:
- `mode: "patch"`: mates escampades en un quadrat (`size` m, `density` per m²) en un sol GLB (després `npx gltfpack -c`):
  `public/models/grass_patch.glb`.
- `mode: "tex"`: la gespa vista de dalt (Cycles, ortogràfica, còpies a les vores perquè es repeteixi):
  `public/textures/grass_lawn/diff.jpg` (després, més clar i el relleu i la brillantor de la lluminositat).
Ús: python3 -c "import sys; sys.argv=['x','--','<json>']; exec(open('scripts/polyhaven-grass.py').read())"
amb `pip install bpy`; `rgba`: la textura de color amb l'alfa (1K) feta abans amb PIL.
"""
import bpy, random, math, sys, json
cfg = json.loads(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else {}
BL = "/mnt/user-data/uploads/grass_medium_01_4k.blend/grass_medium_01_4k.blend"
TX = "/mnt/user-data/uploads/grass_medium_01_4k.blend/textures/"
bpy.ops.wm.open_mainfile(filepath=BL)
mode = cfg.get("mode", "patch")
lod = cfg.get("lod", "LOD2")
src = [o for o in bpy.data.objects if o.type == "MESH" and o.name.endswith(lod) and "geonodes" in o.name]
print("clumps", [(o.name, len(o.data.polygons)) for o in src])
# Material: textura de color + alfa (la del fitxer apunta a camins del Mac).
img = bpy.data.images.load(cfg.get("rgba", "/tmp/grass/rgba1k.png"))
mat = bpy.data.materials.new("grass"); mat.use_nodes = True; nt = mat.node_tree
for nd in list(nt.nodes): nt.nodes.remove(nd)
out = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled")
t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
nt.links.new(t.outputs["Color"], b.inputs["Base Color"]); nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
b.inputs["Roughness"].default_value = 0.85
nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
meshes = []
for o in src:
    m = o.data.copy(); m.materials.clear(); m.materials.append(mat)
    # Centre a l'origen, a terra (z mínima 0).
    import mathutils
    xs = [v.co.x for v in m.vertices]; ys = [v.co.y for v in m.vertices]; zs = [v.co.z for v in m.vertices]
    off = mathutils.Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, min(zs)))
    for v in m.vertices: v.co -= off
    meshes.append((o.name, m))
scene_objs = [o for o in bpy.data.objects]
for o in scene_objs: bpy.data.objects.remove(o)
rng = random.Random(cfg.get("seed", 3))
S = cfg.get("size", 2.0)
N = int(cfg.get("density", 30) * S * S)
pts = []
for i in range(N):
    name, m = rng.choice(meshes)
    pts.append((name, m, rng.uniform(0, S), rng.uniform(0, S), rng.uniform(0, 2*math.pi), rng.uniform(0.85, 1.3)))
objs = []
def place(m, x, y, r, s):
    o = bpy.data.objects.new("c", m); bpy.context.scene.collection.objects.link(o)
    o.location = (x, y, 0); o.rotation_euler = (0, 0, r); o.scale = (s, s, s * rng.uniform(0.9, 1.15))
    objs.append(o)
if mode == "patch":
    for (_, m, x, y, r, s) in pts:
        # Dins del quadrat (sense que surtin gaire): un pèl cap a dins.
        place(m, 0.12 + x * (S - 0.24) / S, 0.12 + y * (S - 0.24) / S, r, s)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    print("tris", sum(len(p.vertices) - 2 for p in j.data.polygons))
    bpy.ops.export_scene.gltf(filepath=cfg["out"], use_selection=True, export_format="GLB", export_image_format="WEBP", export_apply=True)
else:
    # Textura de gespa vista de dalt, que es repeteix: còpies a ±S a les vores.
    for (_, m, x, y, r, s) in pts:
        for dx in (-S, 0, S):
            for dy in (-S, 0, S):
                X, Y = x + dx, y + dy
                if -0.3 < X < S + 0.3 and -0.3 < Y < S + 0.3:
                    place(m, X, Y, r, s)
    bpy.ops.mesh.primitive_plane_add(size=S * 1.5, location=(S/2, S/2, 0.0))
    g = bpy.context.active_object
    gm = bpy.data.materials.new("soil"); gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.035, 0.03, 0.015, 1)
    gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1
    g.data.materials.append(gm)
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = S
    co = bpy.data.objects.new("cam", cam); bpy.context.scene.collection.objects.link(co)
    co.location = (S/2, S/2, 3); co.rotation_euler = (0, 0, 0)
    bpy.context.scene.camera = co
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.5; sun.angle = math.radians(25)
    so = bpy.data.objects.new("sun", sun); bpy.context.scene.collection.objects.link(so); so.rotation_euler = (math.radians(30), math.radians(10), 0)
    w = bpy.data.worlds.new("w"); w.use_nodes = True; w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.6, 0.7, 0.85, 1); w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    bpy.context.scene.world = w
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = cfg.get("samples", 48); sc.cycles.device = "CPU"
    try: sc.cycles.use_denoising = True
    except Exception: pass
    sc.render.resolution_x = sc.render.resolution_y = cfg.get("px", 1024)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = cfg["out"]
    bpy.ops.render.render(write_still=True)
print("ok")
