"""Converteix un arbre de Poly Haven (.blend) en un GLB lleuger per al web: escorça delmada, una part de les fulles
(grups solts sencers, una mica més grans perquè la copa no quedi buida) i textures petites en WebP."""
import sys, json, random
import bpy, numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from PIL import Image

cfg = json.loads(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.open_mainfile(filepath=cfg["blend"])
src = bpy.data.objects[cfg["object"]]
me = src.data
nv = len(me.vertices)
co = np.empty(nv * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
npoly = len(me.polygons)
mi = np.empty(npoly, np.int32); me.polygons.foreach_get("material_index", mi)
ls = np.empty(npoly, np.int32); me.polygons.foreach_get("loop_start", ls)
lt = np.empty(npoly, np.int32); me.polygons.foreach_get("loop_total", lt)
nl = len(me.loops)
lv = np.empty(nl, np.int32); me.loops.foreach_get("vertex_index", lv)
if len(me.uv_layers):
    uv = np.empty(nl * 2, np.float32); (me.uv_layers.active or me.uv_layers[0]).data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
else:
    # Alguns fitxers porten les UV com a atribut de 3 components (FLOAT_VECTOR).
    at = me.attributes["UVMap"]
    uv3 = np.empty(nl * 3, np.float32); at.data.foreach_get("vector", uv3); uv = uv3.reshape(-1, 3)[:, :2].copy()
matnames = [m.name for m in me.materials]
rng = random.Random(7)
out_tris = {}  # material -> list of (pos3, uv2) per vertex triplets

def tris_of(polys):
    P, U = [], []
    for p in polys:
        s, t = ls[p], lt[p]
        for k in range(1, t - 1):
            for L in (s, s + k, s + k + 1):
                P.append(co[lv[L]]); U.append(uv[L])
    return np.array(P, np.float32).reshape(-1, 3), np.array(U, np.float32).reshape(-1, 2)

for mname, rule in cfg["materials"].items():
    idx = matnames.index(mname)
    polys = np.nonzero(mi == idx)[0]
    if rule["mode"] in ("leaves", "bark_islands"):
        # Grups solts (connectats per vèrtexs) dels polígons d'aquest material.
        rows, cols = [], []
        for p in polys:
            s, t = ls[p], lt[p]
            vs = lv[s:s + t]
            rows.extend(vs[:-1]); cols.extend(vs[1:])
        g = coo_matrix((np.ones(len(rows), np.int8), (rows, cols)), shape=(nv, nv))
        _, lab = connected_components(g, directed=False)
        plab = lab[lv[ls[polys]]]
        groups = {}
        for p, l in zip(polys, plab):
            groups.setdefault(l, []).append(p)
        keys = list(groups); rng.shuffle(keys)
        if rule["mode"] == "bark_islands":
            # Les branques més grosses primer: les petites (brotets dins de la copa) són les que sobren.
            keys.sort(key=lambda k: -len(groups[k]))
        budget = rule["faces"]; kept = []; n = 0
        for k in keys:
            if n >= budget: break
            kept.append(k); n += len(groups[k])
        frac = len(kept) / max(1, len(keys))
        grow = 1.0 if rule["mode"] == "bark_islands" else min(rule.get("maxGrow", 1.8), (1 / max(frac, 1e-3)) ** (1 / 3))
        P, U = [], []
        for k in kept:
            ps, us = tris_of(groups[k])
            c = ps.mean(axis=0)
            P.append(c + (ps - c) * grow); U.append(us)
        P = np.concatenate(P); U = np.concatenate(U)
        print(mname, "groups", len(keys), "kept", len(kept), "grow", round(grow, 2), "tris", len(P) // 3)
    else:
        P, U = tris_of(polys)
        print(mname, "tris", len(P) // 3)
    out_tris[mname] = (P, U, rule)

# Nova escena amb una malla per material (delmant l'escorça si cal).
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = []
for mname, (P, U, rule) in out_tris.items():
    n = len(P)
    m = bpy.data.meshes.new(mname)
    m.vertices.add(n); m.vertices.foreach_set("co", P.ravel())
    m.loops.add(n); m.loops.foreach_set("vertex_index", np.arange(n, dtype=np.int32))
    m.polygons.add(n // 3); m.polygons.foreach_set("loop_start", np.arange(0, n, 3, dtype=np.int32)); m.polygons.foreach_set("loop_total", np.full(n // 3, 3, np.int32))
    uvl = m.uv_layers.new(); uvl.data.foreach_set("uv", U.ravel())
    m.update(); m.validate()
    o = bpy.data.objects.new(mname, m); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=1e-5, use_unselected=False); bpy.ops.object.mode_set(mode="OBJECT")
    if rule.get("ratio", 1) < 1:
        d = o.modifiers.new("dec", "DECIMATE"); d.ratio = rule["ratio"]; d.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="dec")
    bpy.ops.object.shade_smooth()
    o.select_set(False)
    # Textura (alfa a part, si n'hi ha), reduïda.
    im = Image.open(rule["diff"]).convert("RGB").resize((rule["size"], rule["size"]), Image.LANCZOS)
    if rule.get("alpha"):
        im.putalpha(Image.open(rule["alpha"]).convert("L").resize((rule["size"], rule["size"]), Image.LANCZOS))
    tp = f"/tmp/trees/{cfg['name']}_{mname}.png"; im.save(tp)
    img = bpy.data.images.load(tp)
    mat = bpy.data.materials.new(mname); mat.use_nodes = True; nt = mat.node_tree
    for nd in list(nt.nodes): nt.nodes.remove(nd)
    outn = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled"); t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    if rule.get("alpha"): nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.8
    nt.links.new(b.outputs["BSDF"], outn.inputs["Surface"])
    m.materials.append(mat)
    print(mname, "final faces", len(o.data.polygons))
    objs.append(o)
for o in objs: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=cfg["out"], use_selection=True, export_format="GLB", export_image_format="WEBP", export_apply=True)
print("ok")
