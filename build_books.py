#!/usr/bin/env python
"""Collect every readable book item in vanilla BG3 and where it can be obtained.

Run from anywhere:  python build_books.py
Writes books.json, books.csv and regions.json next to this script.
"""
import csv
import glob
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
BG3DND = HERE.parent / "bg3dnd"
sys.path.insert(0, str(BG3DND / ".claude/skills/bg3-data/scripts"))
from lsf import Lsf  # noqa: E402

U = r"D:/BG3/응용프로그램/bg3-modders-multitool/UnpackedData"
PACKS = ["Shared/Public/Shared", "Shared/Public/SharedDev", "Gustav/Public/Gustav",
         "Gustav/Public/GustavDev", "GustavX/Public/GustavX", "Gustav/Public/Honour",
         "GustavX/Public/HonourX"]


def load_loca(path):
    out = {}
    for c in ET.parse(path).getroot().iter("content"):
        out[c.get("contentuid")] = c.text or ""
    return out


KO = load_loca(BG3DND / ".reference/bg3-original-korean.xml")
EN = load_loca(BG3DND / ".reference/bg3-original-english.xml")


def handle(v):
    if isinstance(v, tuple):
        v = v[0]
    v = str(v or "").split(";")[0]
    return v if v.startswith("h") and "g" in v else ""


def txt(h, d):
    return d.get(h, "") if h else ""


def book_action(go):
    """BookId and BookType of a GameObjects node's own OnUsePeaceActions (None if absent)."""
    for a in go.walk():
        if a.name == "Action" and str(a.val("ActionType")) == "11":
            for at in a.walk():
                if at.val("BookId") is not None:
                    return at.val("BookId")
    return None


def position(go):
    for c in go.walk():
        if c.name == "Transform" and c.val("Position"):
            p = list(map(float, str(c.val("Position")).split()))[:3]
            r = list(map(float, str(c.val("RotationQuat") or "0 0 0 1").split()))
            return p, r
    return None, None


def children(go, parent, child, attr):
    out = []
    for c in go.walk():
        if c.name == child and c.parent and c.parent.name == parent and c.parent.parent is go:
            v = c.val(attr)
            if v:
                out.append(str(v))
    return out


# ---------- books (content) ----------
BOOKS = {}
for f in glob.glob(U + "/*/Mods/*/Localization/*.lsf") + glob.glob(U + "/*/Public/*/Localization/*.lsf"):  # Gazette and epilogue letters are books too
    if not (HERE / "converted" / (Path(f).stem + ".lsx")).exists() and Path(f).stem in ("Act0_Books", "Act1_PLA_Books"):
        continue
    try:
        for k in Lsf(f).find(node="TranslatedStringKey"):
            BOOKS[k.val("UUID")] = {"content": handle(k.val("Content")), "file": Path(f).name}
    except ValueError:  # compressed: converted to converted/<name>.lsx with Divine
        if not (HERE / "converted" / (Path(f).stem + ".lsx")).exists():
            continue
        for n in ET.parse(HERE / "converted" / (Path(f).stem + ".lsx")).getroot().iter("node"):
            if n.get("id") == "TranslatedStringKey":
                a = {x.get("id"): x for x in n.findall("attribute")}
                BOOKS[a["UUID"].get("value")] = {"content": a["Content"].get("handle", ""), "file": Path(f).name}

# ---------- root templates ----------
TPL = {}
FIELDS = ["Name", "Stats", "DisplayName", "UnknownDisplayName", "Description", "UnknownDescription",
          "ParentTemplateId", "Icon", "BookType", "StoryItem", "Type"]
for p in PACKS:
    f = U + "/" + p + "/RootTemplates/_merged.lsf"
    if not Path(f).exists():
        continue
    for go in Lsf(f).find(node="GameObjects"):
        d = {k: go.val(k) for k in FIELDS if go.val(k) is not None}
        d["BookId"] = book_action(go)
        d["Treasures"] = children(go, "Treasures", "TreasureItem", "Object")
        d["TradeTreasures"] = children(go, "TradeTreasures", "TreasureItem", "Object")
        d["pack"] = p.split("/")[-1]
        TPL[str(go.val("MapKey"))] = d


def resolve(key, field, seen=None):
    seen = seen or set()
    d = TPL.get(key)
    if not d or key in seen:
        return None
    seen.add(key)
    v = d.get(field)
    if v not in (None, "", []) and not (field.endswith("DisplayName") and not handle(v)):
        return v
    return resolve(str(d.get("ParentTemplateId") or ""), field, seen)


BOOK_TPL = {k: d for k, d in TPL.items() if resolve(k, "BookId")}
BY_NAME = defaultdict(list)
for k, d in TPL.items():
    for n in (d.get("Name"), d.get("Stats")):
        if n:
            BY_NAME[str(n)].append(k)

# ---------- regions (subregion triggers) ----------
SUBKEYS = {}
for f in glob.glob(U + "/*/Mods/*/Localization/*Subregions*.lsf"):
    for k in Lsf(f).find(node="TranslatedStringKey"):
        SUBKEYS[k.val("UUID")] = handle(k.val("Content"))
REGIONS = defaultdict(list)  # level -> [box]
for f in glob.glob(U + "/*/Mods/*/Levels/*/Triggers/_merged.lsf"):
    for go in Lsf(f).find(node="GameObjects"):
        name = str(go.val("Name") or "")
        key = name[2:] if name.startswith("S_") else name
        if key in SUBKEYS and go.val("Extents"):
            p, r = position(go)
            if not p:
                continue
            ext = list(map(float, str(go.val("Extents")).split()))
            h = SUBKEYS[key]
            REGIONS[str(go.val("LevelName"))].append(
                {"key": key, "ko": txt(h, KO), "en": txt(h, EN), "handle": h, "pos": p, "rot": r, "ext": ext})


def qrot_inv(q, v):
    x, y, z, w = q
    # rotate v by conjugate quaternion
    x, y, z = -x, -y, -z
    tx = 2 * (y * v[2] - z * v[1]); ty = 2 * (z * v[0] - x * v[2]); tz = 2 * (x * v[1] - y * v[0])
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]


LEVEL_NAMES = {}
for f in glob.glob(U + "/*/Mods/*/Localization/Levels.lsf"):
    for k in Lsf(f).find(node="TranslatedStringKey"):
        LEVEL_NAMES[k.val("UUID")] = handle(k.val("Content"))


NEAREST_MAX = 30  # metres; farther than this the nearest subregion name is not used


def region_of(level, p):
    r = region_in(level, p, REGIONS.get(level, []))
    if r and r["method"] == "inside":
        return r
    # Sublevels (BGO_WyrmsCrossing_C, CTY_LowerCity_A ...) have no subregion triggers of their own.
    # Each main level has its own coordinate space (CTY_Main_A's Lower City box overlaps WLD_Main_A
    # coordinates), so only the main level of the same prefix is tried, and only a point inside a box counts.
    main = [lv for lv in REGIONS if lv != level and lv.split("_")[0] == level.split("_")[0] and "_Main" in lv]
    other = region_in(level, p, [b for lv in main for b in REGIONS[lv]])
    if other and other["method"] == "inside":
        other["method"] = "inside (main level)"
        return other
    if r and float(r["method"].split()[1].rstrip("m")) <= NEAREST_MAX:
        return r
    h = LEVEL_NAMES.get(level, "")
    return {"ko": txt(h, KO), "en": txt(h, EN), "key": level, "method": "level name only"} if h else None


def region_in(level, p, boxes):
    if not p:
        return None
    inside = []
    for b in boxes:
        local = qrot_inv(b["rot"], [p[i] - b["pos"][i] for i in range(3)])
        if all(abs(local[i]) <= b["ext"][i] / 2 for i in range(3)):
            inside.append((b["ext"][0] * b["ext"][1] * b["ext"][2], b))
    if inside:
        b = min(inside, key=lambda t: t[0])[1]
        return {"ko": b["ko"], "en": b["en"], "key": b["key"], "method": "inside"}
    near = [(math.dist(p, b["pos"]), b) for b in REGIONS.get(level, [])]
    if near:
        dist, b = min(near, key=lambda t: t[0])
        return {"ko": b["ko"], "en": b["en"], "key": b["key"], "method": f"nearest {dist:.0f}m"}
    return None


# ---------- level objects ----------
PLACE = defaultdict(list)   # template key -> placements
TRADERS = defaultdict(list)  # treasure table -> [holder]
LOOTERS = defaultdict(list)
LEVEL_OBJ = {}
level_files = glob.glob(U + "/*/Mods/*/Levels/*/*/_merged.lsf") + glob.glob(U + "/*/Mods/*/Globals/*/*/_merged.lsf")
level_files = [f for f in level_files if Path(f).parent.name in ("Items", "Characters")]
for f in level_files:
    kind = Path(f).parent.name
    for go in Lsf(f).find(node="GameObjects"):
        mk = str(go.val("MapKey"))
        tpl = str(go.val("TemplateName") or "")
        p, _ = position(go)
        lvl = str(go.val("LevelName") or Path(f).parts[-3])
        dn = handle(go.val("DisplayName")) or handle(resolve(tpl, "DisplayName"))
        LEVEL_OBJ[mk] = {"name": go.val("Name"), "tpl": tpl, "pos": p, "level": lvl, "kind": kind,
                         "display": dn, "inv": children(go, "InventoryList", "InventoryItem", "Object"),
                         "own_book": book_action(go)}
        holder = {"name": str(go.val("Name")), "ko": txt(dn, KO), "en": txt(dn, EN), "level": lvl, "pos": p}
        tt = children(go, "TradeTreasures", "TreasureItem", "Object") or (TPL.get(tpl, {}).get("TradeTreasures") if tpl in TPL else []) or []
        for t in tt:
            TRADERS[t].append(holder)
        lt = children(go, "Treasures", "TreasureItem", "Object") or (TPL.get(tpl, {}).get("Treasures") if tpl in TPL else []) or []
        for t in lt:
            LOOTERS[t].append(holder)
        for it in go.walk():
            if it.name == "Item" and it.parent and it.parent.name == "ItemList":
                tid = str(it.val("TemplateID") or "")
                if tid in BOOK_TPL:
                    PLACE[tid].append({"how": "carried" if kind == "Characters" else "container_itemlist",
                                       "holder": holder, "level": lvl, "pos": p})

CONTAINER_OF = {}
for mk, o in LEVEL_OBJ.items():
    for inner in o["inv"]:
        CONTAINER_OF[inner] = mk

for mk, o in LEVEL_OBJ.items():
    tpl = o["tpl"]
    book = o["own_book"] or resolve(tpl, "BookId")
    if o["kind"] != "Items" or not book:
        continue
    if tpl not in BOOK_TPL:
        BOOK_TPL[tpl] = TPL.get(tpl, {"Name": o["name"]})
    c = CONTAINER_OF.get(mk)
    entry = {"how": "level", "mapkey": mk, "instance": str(o["name"]), "level": o["level"], "pos": o["pos"], "book": book,
             "title": o["display"]}
    if c:
        co = LEVEL_OBJ[c]
        entry.update(how="in_container", container=str(co["name"]), container_ko=txt(co["display"], KO),
                     container_en=txt(co["display"], EN))
        entry["pos"] = co["pos"] or o["pos"]
    PLACE[tpl].append(entry)

# ---------- treasure tables ----------
TT = defaultdict(set)  # table -> entries
for f in glob.glob(U + "/*/Public/*/Stats/Generated/TreasureTable.txt"):
    cur = None
    for line in open(f, encoding="utf-8", errors="replace"):
        if m := re.match(r'^new treasuretable "([^"]+)"', line):
            cur = m.group(1)
        elif cur and (m := re.match(r'^object category "([^"]+)"', line)):
            TT[cur].add(m.group(1))
PARENT = defaultdict(set)
for t, es in TT.items():
    for e in es:
        if e.startswith("T_"):
            PARENT[e[2:]].add(t)


def roots(t, seen=None):
    seen = seen or set()
    if t in seen:
        return set()
    seen.add(t)
    ps = PARENT.get(t)
    out = {t}
    for p in ps or ():
        out |= roots(p, seen)
    return out


TT_HITS = defaultdict(list)  # template key -> [table]
for t, es in TT.items():
    for e in es:
        if e.startswith("I_"):
            for k in BY_NAME.get(e[2:], []):
                if k in BOOK_TPL:
                    TT_HITS[k].append(t)

# ---------- Osiris story scripts ----------
GUID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
GIVE = re.compile(r"^\s*(TemplateAddTo|CreateAtObject|CreateAt)\(([^;]*)\)\s*;?\s*$")
OSI = defaultdict(list)  # template key -> [give]
OSI_MOVE = defaultdict(list)  # level instance MapKey -> [ToInventory]


def osi_target(arg):
    g = GUID.findall(arg)
    if g and g[-1] in LEVEL_OBJ:
        o = LEVEL_OBJ[g[-1]]
        return {"target": arg.strip(), "target_ko": txt(o["display"], KO), "level": o["level"], "pos": o["pos"]}
    return {"target": arg.strip(), "target_ko": "플레이어" if "Player" in arg or "_Char" in arg else "", "level": "", "pos": None}


for f in glob.glob(U + "/*/Mods/*/Story/RawFiles/Goals/*.txt"):
    goal = Path(f).stem
    text = open(f, encoding="utf-8", errors="replace").read()
    # a rule runs from IF/PROC/QRY to the next one; facts in INIT/KB sections are single lines
    blocks = re.split(r"\n(?=IF\b|PROC\b|QRY\b)", text)
    for blk in blocks:
        lines = blk.splitlines()
        var_give = [m for ln in lines if (m := GIVE.match(ln)) and m.group(2).lstrip().startswith("_")]
        for ln in lines:
            m = GIVE.match(ln)
            if m:
                args = m.group(2).split(",")
                for g in GUID.findall(args[0]):
                    if g in BOOK_TPL:
                        OSI[g].append({"goal": goal, "func": m.group(1), "via": "direct",
                                       **osi_target(args[1] if len(args) > 1 else ""), "line": ln.strip()[:200]})
            if (mv := re.match(r"^\s*ToInventory\(([^,]+),([^,]+)", ln)):
                for g in GUID.findall(mv.group(1)):
                    if g in LEVEL_OBJ:
                        OSI_MOVE[g].append({"goal": goal, **osi_target(mv.group(2)), "line": ln.strip()[:200]})
    # templates listed in DB facts that a rule hands to TemplateAddTo/CreateAt through a variable
    for ln in text.splitlines():
        db = re.match(r"^\s*(DB_\w+)\(", ln)
        if not db:
            continue
        for g in GUID.findall(ln):
            if g not in BOOK_TPL:
                continue
            for blk in blocks:
                if db.group(1) + "(" in blk and blk.lstrip().startswith(("IF", "PROC", "QRY")):
                    gm = [m for b in blk.splitlines() if (m := GIVE.match(b)) and m.group(2).lstrip().startswith("_")]
                    if gm:
                        OSI[g].append({"goal": goal, "func": gm[0].group(1), "via": db.group(1),
                                       **osi_target(gm[0].group(2).split(",")[1] if "," in gm[0].group(2) else ""),
                                       "line": ln.strip()[:200]})
                        break

# ---------- tags ----------
TAGS = [
    ("샤 (Shar)", r"\bShar(?:'s|ran|rans)?\b"), ("셀루네 (Selûne)", r"Sel[uû]ne"), ("바알 (Bhaal)", r"\bBhaal"),
    ("머쿨 (Myrkul)", r"Myrkul"), ("베인 (Bane)", r"\bBane\b"), ("삼악신 (Dead Three)", r"Dead Three"),
    ("라샌더 (Lathander)", r"Lathander"), ("미스트라 (Mystra)", r"Mystra"), ("간드 (Gond)", r"\bGond\b"),
    ("티르 (Tyr)", r"\bTyr\b"), ("탈로스 (Talos)", r"\bTalos\b"), ("로비아타 (Loviatar)", r"Loviatar"),
    ("롤스 (Lolth)", r"Lolth"), ("실바너스 (Silvanus)", r"Silvanus"), ("일메이터 (Ilmater)", r"Ilmater"),
    ("미엘리키 (Mielikki)", r"Mielikki"), ("오그마 (Oghma)", r"Oghma"), ("템퍼스 (Tempus)", r"Tempus"),
    ("절대자 (The Absolute)", r"\bAbsolute\b"), ("마인드 플레이어 (Illithid)", r"[Ii]llithid|[Mm]ind [Ff]layer|tadpole|[Ee]lder [Bb]rain|ceremorph"),
    ("기스양키 (Githyanki)", r"[Gg]ith(?:yanki|zerai)?\b|Vlaakith"), ("드로우 (Drow)", r"\b[Dd]row\b|Menzoberranzan"),
    ("드웨가 (Duergar)", r"[Dd]uergar"), ("뱀파이어 (Vampire)", r"[Vv]ampire|Cazador|spawn of"),
    ("네더릴 (Netheril)", r"Nether(?:il|ese)"), ("발더스 게이트 (Baldur's Gate)", r"Baldur's Gate|Lower City|Upper City|Rivington|Wyrm's Crossing"),
    ("불주먹 (Flaming Fist)", r"Flaming Fist"), ("하퍼 (Harpers)", r"Harper"), ("젠타림 (Zhentarim)", r"Zhentarim|\bZhent"),
    ("강철 감시대 (Steel Watch)", r"Steel Watch"), ("고타쉬 (Gortash)", r"Gortash"), ("오린 (Orin)", r"\bOrin\b"),
    ("케더릭 (Ketheric)", r"Ketheric"), ("그림자 저주 (Shadow Curse)", r"[Ss]hadow[- ][Cc]urse|Shadowfell"),
    ("악마·지옥 (Devils/Hells)", r"\b[Dd]evil|Avernus|Nine Hells|\bHells\b|Mephistopheles|Zariel|infernal|soul coin"),
    ("마귀·심연 (Demons/Abyss)", r"\b[Dd]emon|Abyss"), ("마귀할멈 (Hag)", r"\b[Hh]ag\b|Auntie Ethel"),
    ("드래곤 (Dragon)", r"[Dd]ragon"), ("언데드 (Undead)", r"[Uu]ndead|[Zz]ombie|[Ss]keleton|[Gg]houl|[Ll]ich\b|[Ww]raith"),
    ("사령술 (Necromancy)", r"[Nn]ecroman"), ("마법 학파·위브 (Magic/Weave)", r"\bWeave\b|[Ww]izard|[Ss]pell|[Ee]vocation|[Aa]bjuration|[Tt]ransmutation|[Ii]llusion|[Dd]ivination|[Cc]onjuration|[Ee]nchantment"),
    ("연금술 (Alchemy)", r"[Aa]lchem|[Pp]otion|[Ee]lixir|[Rr]ecipe"), ("드루이드 (Druid)", r"[Dd]ruid|Emerald Grove|Halsin"),
    ("고블린 (Goblin)", r"[Gg]oblin"), ("티플링 (Tiefling)", r"[Tt]iefling"), ("오크 (Orc)", r"\b[Oo]rcs?\b"),
    ("엘프 (Elf)", r"\b[Ee]lv(?:es|en)\b|\b[Ee]lf\b"), ("드워프 (Dwarf)", r"[Dd]warf|[Dd]warv"),
    ("노움 (Gnome)", r"\b[Gg]nom(?:e|es|ish)\b"), ("하플링 (Halfling)", r"[Hh]alfling"), ("오우거·거인 (Giants)", r"\b[Oo]gres?\b|\b[Gg]iants?\b(?! [Ss]pider)"),
    ("마이코니드 (Myconid)", r"[Mm]yconid|[Ss]poreling"), ("언더다크 (Underdark)", r"Underdark"),
    ("달오름 탑 (Moonrise Towers)", r"Moonrise"), ("일릭 양성소 (Crèche)", r"Cr[eè]che"), ("엘민스터 (Elminster)", r"Elminster"),
    ("볼로 (Volo)", r"\bVolo"), ("라파엘·미조라 (Raphael/Mizora)", r"Raphael|Mizora|Haarlep"), ("카서스 (Karsus)", r"Karsus|Karsite"),
    ("레시피·제작 (Crafting)", r"[Rr]ecipe|ingredient"),
    ("시·노래 (Poem/Song)", r"[Pp]oem|[Ss]ong|[Bb]allad|[Vv]erse"), ("역사 (History)", r"[Hh]istory|[Cc]hronicle|[Aa]nnals"),
    ("종교·기도 (Faith)", r"[Pp]rayer|[Tt]emple|[Pp]riest|[Ss]cripture|[Hh]oly"),
]
TAGS = [(n, re.compile(p)) for n, p in TAGS]


LETTER = re.compile(r"[Jj]ournal|[Dd]iary|[Ll]etter|\b[Nn]ote\b|[Ll]og\b|[Mm]emo|[Rr]eport")


def infer_tags(text, title):
    tags = [n for n, rx in TAGS if rx.search(text)]
    if LETTER.search(title):
        tags.append("편지·일지 (Letter/Journal)")
    return tags


# eoc::EBookType names appear in bg3.exe in this order after None; Book.xaml / BookTemplates.xaml
# give each name its background. 8 = GithDisc matches the "Inscribed Githyanki Disc" templates.
BOOK_TYPES = ["None", "PaperSheet", "PaperStack", "ScrollA", "ScrollB", "TabletA", "TabletB", "TabletC", "GithDisc"]
BACKGROUND = {"None": "Book_BG_B1.DDS", "PaperSheet": "paper_Sheet.DDS", "PaperStack": "paper_Stack.DDS",
              "ScrollA": "scroll_A_bg.DDS", "ScrollB": "scroll_B_bg.DDS", "TabletA": "tablet_A_bg.DDS",
              "TabletB": "tablet_B_bg.DDS", "TabletC": "tablet_C_bg.DDS", "GithDisc": "gith_disc_bg.DDS"}


def background(raw):
    name = BOOK_TYPES[int(raw)] if raw is not None and str(raw).isdigit() and int(raw) < len(BOOK_TYPES) else "None"
    return name, "Game/Public/Game/GUI/Assets/Book/" + BACKGROUND[name]


# ---------- assemble ----------
def where_entry(pl):
    lvl, p = pl.get("level"), pl.get("pos")
    reg = region_of(lvl, p)
    return {
        "level": lvl,
        "region_ko": reg["ko"] if reg else "",
        "region_en": reg["en"] if reg else "",
        "region_key": reg["key"] if reg else "",
        "region_method": reg["method"] if reg else "no subregion trigger in level",
        "position": [round(x, 2) for x in p] if p else None,
        "level_ko": txt(LEVEL_NAMES.get(lvl, ""), KO),
        "how": pl["how"],
        "instance_title_ko": txt(pl.get("title", ""), KO), "instance_title_handle": pl.get("title", ""),
        "object": pl.get("instance") or "",
        "container": pl.get("container", ""), "container_ko": pl.get("container_ko", ""),
        "container_en": pl.get("container_en", ""), "holder_en": (pl.get("holder") or {}).get("en", ""),
        "holder": (pl.get("holder") or {}).get("name", ""), "holder_ko": (pl.get("holder") or {}).get("ko", ""),
    }


groups = defaultdict(lambda: {"templates": [], "places": [], "tables": set()})
for k, d in BOOK_TPL.items():
    bid = resolve(k, "BookId")
    g = groups[bid]
    g["templates"].append(k)
    for pl in PLACE.get(k, []):
        if pl.get("book") and pl["book"] != bid:
            groups[pl["book"]]["places"].append((k, pl))
        else:
            g["places"].append((k, pl))
    g["tables"] |= set(TT_HITS.get(k, []))

out = []
for bid, g in sorted(groups.items(), key=lambda t: str(t[0])):
    if not g["templates"] and not g["places"]:
        continue
    tpls = []
    for k in g["templates"]:
        dn, un = handle(resolve(k, "DisplayName")), handle(resolve(k, "UnknownDisplayName"))
        de, ude = handle(resolve(k, "Description")), handle(resolve(k, "UnknownDescription"))
        tpls.append({"mapkey": k, "name": TPL.get(k, {}).get("Name"), "stats": resolve(k, "Stats"),
                     "pack": TPL.get(k, {}).get("pack"), "icon": resolve(k, "Icon"),
                     "display_handle": dn, "display_ko": txt(dn, KO), "display_en": txt(dn, EN),
                     "unknown_display_handle": un, "unknown_display_ko": txt(un, KO), "unknown_display_en": txt(un, EN),
                     "description_handle": de, "description_ko": txt(de, KO),
                     "unknown_description_handle": ude, "unknown_description_ko": txt(ude, KO),
                     "book_type_raw": resolve(k, "BookType"),
                     "book_type": background(resolve(k, "BookType"))[0],
                     "background": background(resolve(k, "BookType"))[1], "story_item": str(resolve(k, "StoryItem")) == "True"})
    b = BOOKS.get(bid, {})
    ch = b.get("content", "")
    places = [where_entry(pl) for _, pl in g["places"]]
    shops, loots, other = [], [], []
    for t in sorted(g["tables"]):
        rs = roots(t)
        tr = [h for r in rs for h in TRADERS.get(r, [])]
        lt = [h for r in rs for h in LOOTERS.get(r, [])]
        for h in tr:
            reg = region_of(h["level"], h["pos"])
            shops.append({"table": t, "trader": h["name"], "trader_ko": h["ko"], "trader_en": h["en"], "level": h["level"],
                          "region_ko": reg["ko"] if reg else "", "region_en": reg["en"] if reg else ""})
        for h in lt:
            reg = region_of(h["level"], h["pos"])
            loots.append({"table": t, "holder": h["name"], "holder_ko": h["ko"], "level": h["level"],
                          "region_ko": reg["ko"] if reg else ""})
        if not tr and not lt:
            other.append({"table": t, "root_tables": sorted(rs)})
    osi = []
    for k in g["templates"]:
        for o in OSI.get(k, []):
            reg = region_of(o["level"], o["pos"]) if o["pos"] else None
            osi.append({k2: v for k2, v in o.items() if k2 != "pos"} | {"region_ko": reg["ko"] if reg else ""})
    moved = []
    for _, pl in g["places"]:
        for o in OSI_MOVE.get(pl.get("mapkey", ""), []):
            moved.append({k2: v for k2, v in o.items() if k2 != "pos"} | {"object": pl.get("instance", "")})
    acq = []
    if any(p["how"] in ("level", "in_container") for p in places):
        acq.append("맵에 배치")
    if any(p["how"] in ("carried", "container_itemlist") for p in places):
        acq.append("캐릭터·컨테이너 소지품(ItemList)")
    if loots or other:
        acq.append("treasure table에서 획득")
    if shops:
        acq.append("상점에서 구매")
    if osi:
        acq.append("스토리 스크립트(Osiris) 지급")
    count = len(places) + len(osi)
    unique = count == 1 and not g["tables"]
    en_all = " ".join([t["display_en"] for t in tpls] + [txt(ch, EN)])
    out.append({
        "book_id": bid, "book_file": b.get("file", ""), "content_handle": ch,
        "content_ko": txt(ch, KO), "content_en": txt(ch, EN),
        "title_ko": sorted({t["display_ko"] for t in tpls if t["display_ko"]} | {p["instance_title_ko"] for p in places if p["instance_title_ko"]}),
        "title_handles": sorted({t["display_handle"] for t in tpls if t["display_handle"]} | {p["instance_title_handle"] for p in places if p["instance_title_handle"]}),
        "unknown_title_ko": sorted({t["unknown_display_ko"] for t in tpls if t["unknown_display_ko"]}),
        "templates": tpls,
        "book_type_raw": sorted({str(t["book_type_raw"]) for t in tpls if t["book_type_raw"] is not None}),
        "backgrounds": sorted({f'{t["book_type"]} ({t["background"].rsplit("/", 1)[-1]})' for t in tpls}),
        "placement_count": count,
        "uniqueness": "유일(1개)" if unique else ("획득처 확인 안 됨" if count == 0 and not g["tables"] else "복수 획득 가능"),
        "acquisition": acq,
        "found_at": places, "shops": shops, "loot_holders": loots, "tables_unresolved": other,
        "osiris_given": osi, "osiris_moved": moved,
        "treasure_tables": sorted(g["tables"]),
        "tags_inferred": infer_tags(en_all, " ".join(t["display_en"] for t in tpls)),
    })

unreadable = [b for b in out if b["book_id"] == "GEN_Unreadable"]
out = [b for b in out if b["book_id"] != "GEN_Unreadable"]
json.dump(unreadable, open(HERE / "books_unreadable.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(out, open(HERE / "books.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(REGIONS, open(HERE / "regions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def uniq(xs):
    return sorted({x for x in xs if x})


with open(HERE / "books.csv", "w", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["BookId", "제목(DisplayName)", "미확인 제목(UnknownDisplayName)", "제목 핸들", "미확인 제목 핸들",
                "내용 핸들", "BookType 원값", "열람 배경", "유형", "배치 수", "획득 유형", "발견 장소", "판매 상인", "트레저 테이블", "Osiris 지급",
                "템플릿 이름", "추론 태그"])
    for b in out:
        t = b["templates"]
        spots = []
        for p in b["found_at"]:
            s = p["region_ko"] or p["level"]
            if p["container_ko"]:
                s += f" ({p['container_ko']})"
            if p["holder_ko"]:
                s += f" ({p['holder_ko']} 소지)"
            spots.append(s)
        w.writerow([b["book_id"], " / ".join(b["title_ko"]), " / ".join(b["unknown_title_ko"]),
                    " / ".join(b["title_handles"]), " / ".join(uniq(x["unknown_display_handle"] for x in t)),
                    b["content_handle"], " / ".join(b["book_type_raw"]), " / ".join(b["backgrounds"]), b["uniqueness"], b["placement_count"],
                    ", ".join(b["acquisition"]), ", ".join(uniq(spots)),
                    ", ".join(uniq(f"{s['trader_ko'] or s['trader']} - {s['region_ko'] or s['level']}" for s in b["shops"])),
                    ", ".join(b["treasure_tables"]),
                    ", ".join(uniq(f"{o['goal']}:{o['func']}→{o['target_ko'] or o['target']}" + (f" ({o['via']})" if o['via'] != 'direct' else '') for o in b["osiris_given"])), ", ".join(uniq(str(x["name"]) for x in t)),
                    ", ".join(b["tags_inferred"])])
print(len(out), "books;", sum(len(v) for v in REGIONS.values()), "subregion triggers")


# ---------- site data (docs/ is served by GitHub Pages) ----------
def place_label(p):
    s = p["region_ko"] or p["level_ko"] or p["level"]
    if p["container_ko"]:
        s += f" · {p['container_ko']}"
    if p["holder_ko"]:
        s += f" · {p['holder_ko']} 소지"
    return s


site = []
for b in out:
    t = b["templates"]
    site.append({
        "id": b["book_id"], "t": b["title_ko"], "te": sorted({x["display_en"] for x in t if x["display_en"]}),
        "u": b["unknown_title_ko"], "th": b["title_handles"], "ch": b["content_handle"],
        "c": b["content_ko"], "ce": b["content_en"],
        "bg": sorted({x["book_type"] for x in t}) or ["None"], "ty": b["uniqueness"], "n": b["placement_count"],
        "a": b["acquisition"], "tg": b["tags_inferred"],
        "p": sorted({place_label(p) for p in b["found_at"]}),
        "pl": [{"r": p["region_ko"], "l": p["level"], "h": p["how"], "o": p["object"], "k": p["container_ko"] or p["holder_ko"],
                "re": p["region_en"], "ke": p["container_en"] or p["holder_en"], "m": p["region_method"], "xyz": p["position"]} for p in b["found_at"]],
        "s": [dict(t) for t in {(("k", f"{s['trader_ko'] or s['trader']} ({s['region_ko'] or s['level']})"),
                                  ("e", f"{s['trader_en'] or s['trader']} ({s['region_en'] or s['level']})")) for s in b["shops"]}],
        "tt": b["treasure_tables"],
        "os": uniq(f"{o['target_ko'] or o['target']} ← {o['goal']} {o['func']}" + (f" [{o['via']}]" if o["via"] != "direct" else "") for o in b["osiris_given"]),
        "tp": uniq(str(x["name"]) for x in t), "ic": uniq(str(x["icon"]) for x in t if x["icon"]),
    })
(HERE / "docs" / "data").mkdir(parents=True, exist_ok=True)
json.dump(site, open(HERE / "docs" / "data" / "books.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
