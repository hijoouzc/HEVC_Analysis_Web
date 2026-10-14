#!/usr/bin/env python3
"""Render an HM intra probe JSONL trace as a self-contained HTML report."""

import argparse
import json
from pathlib import Path


PAGE = r'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HM Intra Probe Report</title>
<style>
:root{color-scheme:light;--bg:#f3f7fb;--panel:#ffffff;--line:#c9d6e2;--text:#17283b;--muted:#4b5f74;--accent:#006b5e;--gold:#805400;--red:#9e2f2f}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}
main{max-width:1400px;margin:auto;padding:28px}h1,h2,h3{line-height:1.2}h1{margin:0 0 8px}h2{margin:0 0 14px;font-size:1.2rem}h3{margin:14px 0 8px;font-size:1rem}
.muted,.hint{color:var(--muted)}.summary,.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;margin:16px 0;box-shadow:0 2px 8px rgba(34,61,86,.045)}
.summary{display:flex;gap:14px;flex-wrap:wrap}.pill{border:1px solid var(--line);border-radius:999px;padding:7px 12px;background:#f7fafc}.pill b{color:var(--accent)}
#references{grid-template-columns:1fr;gap:8px}#references>div{overflow-x:auto}
.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.step{border:1px solid var(--line);border-radius:10px;padding:13px;background:#f9fbfd}.step strong{display:block;color:var(--accent);margin-bottom:4px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line)}th{color:#344b62;font-weight:700;background:#f1f5f9}tr.selected{background:#d8f2e7;color:#173c31;font-weight:600}tr.selected td{color:#173c31}tr.fastbest{outline:2px solid #b67a00;outline-offset:-2px}tr.fastbest:not(.selected){background:#fff1c4}
button,select{background:#ffffff;color:var(--text);border:1px solid #8fa2b5;border-radius:7px;padding:8px 10px;font:inherit}button{cursor:pointer}button:hover,select:hover{background:#edf4f8}.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.matrix-wrap{overflow:auto}.matrix{border-collapse:collapse;border-spacing:0;width:auto}.matrix td{min-width:38px;height:34px;padding:3px;text-align:center;border:1px solid rgba(25,46,66,.28);border-radius:0;font:12px ui-monospace,monospace;font-weight:600}
.tu{border:1px solid var(--line);border-radius:9px;margin:10px 0;padding:12px;background:#fbfdff}.tu summary{cursor:pointer}.tu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.tree{font:13px/1.8 ui-monospace,monospace;white-space:pre-wrap;color:#24394e}.final{color:var(--gold);font-weight:700}.warn{border-left:4px solid #a66b00;padding:8px 12px;background:#fff2cf;color:#493300}
@media(max-width:760px){main{padding:14px}.flow{grid-template-columns:1fr 1fr}}
</style>
</head>
<body><main>
<h1>HM Intra Probe</h1><div class="muted">Self-contained report generated from trace.jsonl</div>
<div id="summary" class="summary"></div>
<section class="panel"><h2>Encoder flow for this block</h2><div class="flow">
<div class="step"><strong>1 · Reference samples</strong>HM builds top/left neighbors for intra prediction.</div>
<div class="step"><strong>2 · Fast mode scan</strong>Predict all candidate modes and rank by approximate Hadamard cost.</div>
<div class="step"><strong>3 · Full RD trials</strong>Keep candidate modes, form residuals, try TU splits, transform and quantize.</div>
<div class="step"><strong>4 · Final CU choice</strong>The CTU partition tree records the selected CU split and intra mode.</div>
</div></section>
<section class="panel"><h2>Reference samples</h2><div id="references" class="grid2"></div></section>
<section class="panel"><h2>Fast mode ranking</h2><p class="hint">Lower fast cost ranks better in the first pass. It is not the final RD decision.</p><div id="modeTable"></div></section>
<section class="panel"><h2>Inspect one candidate mode</h2><label for="modeSelect">Mode: </label><select id="modeSelect"></select><div id="modeMatrices" class="grid2"></div></section>
<section class="panel"><h2>Transform and quantization trials for this mode</h2><p class="hint">Each card is one TU call. A mode may have repeated calls because HM evaluates TU alternatives and component coding.</p><div id="transforms"></div></section>
<section class="panel"><h2>Final selected CU tree</h2><div id="tree" class="tree"></div></section>
<section class="panel"><h2>How to read this report</h2><div class="warn">Fast cost and transform records describe candidate trials. Only the final tree identifies the selected CU mode. This trace does not mark which individual TU trial won inside full RD.</div></section>
</main>
<script>const DATA=__TRACE_DATA__;
const fast=DATA.fastModes||[], transforms=DATA.transforms||[], refs=DATA.references||null, tree=DATA.tree||null;
const target=DATA.target||{};
function pill(label,value){return `<span class="pill">${label}: <b>${value}</b></span>`}
function findLeaf(node,x,y,size){if(!node)return null;if(!node.split&&node.x===x&&node.y===y&&node.width===size&&node.height===size)return node;for(const c of node.children||[]){const found=findLeaf(c,x,y,size);if(found)return found;}return null}
const selected=tree&&target.pu_x!==undefined?findLeaf(tree,target.pu_x,target.pu_y,target.pu_size):null;
const fastBest=[...fast].sort((a,b)=>a.fast_cost-b.fast_cost)[0];
document.getElementById('summary').innerHTML=[pill('POC',target.poc??'—'),pill('CTU',`${target.ctu_x??'—'}, ${target.ctu_y??'—'}`),pill('PU',`${target.pu_x??'—'}, ${target.pu_y??'—'} · ${target.pu_size??'—'}×${target.pu_size??'—'}`),pill('Fast best',fastBest?`mode ${fastBest.mode}`:'—'),pill('Final mode',selected?`mode ${selected.intra_dir}`:'not found'),pill('Trace',`${fast.length} fast · ${transforms.length} TU calls`) ].join('');
function matrix(title,values,w,h,kind){if(!values||!w||!h||values.length<w*h)return `<div><h3>${title}</h3><span class="muted">No matrix in trace</span></div>`;let max=1;if(kind==='gray')max=255;else max=Math.max(1,...values.slice(0,w*h).map(v=>Math.abs(v)));let cells='';for(let y=0;y<h;y++){cells+='<tr>';for(let x=0;x<w;x++){const v=values[y*w+x];let bg,fg='#17283b';if(kind==='gray'){const g=Math.max(0,Math.min(255,Math.round(v)));bg=`rgb(${g},${g},${g})`;fg=g<132?'#ffffff':'#142235';}else{const a=Math.min(1,Math.abs(v)/max);bg=v>=0?`rgb(${Math.round(244-130*a)},${Math.round(250-95*a)},${Math.round(247-80*a)})`:`rgb(${Math.round(255-4*a)},${Math.round(240-110*a)},${Math.round(234-115*a)})`;}cells+=`<td style="background:${bg};color:${fg}" title="row ${y}, col ${x}">${v}</td>`;}cells+='</tr>';}return `<div><h3>${title} (${w}×${h})</h3><div class="matrix-wrap"><table class="matrix">${cells}</table></div></div>`;}
function matrixLine(title,values){if(!values)return '';return matrix(title,values,values.length,1,'gray');}
if(refs){document.getElementById('references').innerHTML=matrixLine('Unfiltered top',refs.ref_unfilt_top)+matrixLine('Unfiltered left',refs.ref_unfilt_left)+matrixLine('Filtered top',refs.ref_filt_top)+matrixLine('Filtered left',refs.ref_filt_left);}
const tableRows=[...fast].sort((a,b)=>a.fast_cost-b.fast_cost).map((r,i)=>`<tr class="${selected&&r.mode===selected.intra_dir?'selected ':''}${fastBest&&r.mode===fastBest.mode?'fastbest':''}"><td>${i+1}</td><td>${r.mode}</td><td>${Number(r.fast_cost).toFixed(3)}</td><td>${r.use_filtered_references?'yes':'no'}</td><td>${transforms.filter(t=>t.intra_mode===r.mode).length}</td></tr>`).join('');
document.getElementById('modeTable').innerHTML=`<table><thead><tr><th>Rank</th><th>Mode</th><th>Fast cost</th><th>Filtered refs</th><th>TU trials</th></tr></thead><tbody>${tableRows}</tbody></table>`;
const modes=[...new Set([...fast.map(r=>r.mode),...transforms.map(r=>r.intra_mode).filter(m=>m>=0)])].sort((a,b)=>a-b);const select=document.getElementById('modeSelect');select.innerHTML=modes.map(m=>`<option value="${m}" ${selected&&m===selected.intra_dir?'selected':''}>Mode ${m}${fast.find(r=>r.mode===m)?` · cost ${Number(fast.find(r=>r.mode===m).fast_cost).toFixed(3)}`:''}${selected&&m===selected.intra_dir?' · final':''}</option>`).join('');
function showMode(){const mode=Number(select.value),r=fast.find(x=>x.mode===mode);document.getElementById('modeMatrices').innerHTML=r?[matrix('Original Y',r.org_y,r.pu_size,r.pu_size,'gray'),matrix('Prediction Y',r.pred_y,r.pu_size,r.pu_size,'gray'),matrix('Residual Y',r.residual_y,r.pu_size,r.pu_size,'signed')]:`<p>No fast-pass matrix for mode ${mode}; it may be an MPM-added full-RD candidate.</p>`;const list=transforms.filter(t=>t.intra_mode===mode);document.getElementById('transforms').innerHTML=list.length?list.map((t,i)=>`<details class="tu"><summary>Trial ${i+1} · ${t.component} · TU (${t.tu_x},${t.tu_y}) ${t.width}×${t.height} · TU depth ${t.tu_depth} · QP ${t.qp}</summary><div class="tu-grid">${matrix('Residual',t.residual,t.width,t.height,'signed')}${matrix('Transform coefficients',t.transform_coeff,t.width,t.height,'signed')}${matrix('Quantized coefficients',t.quant_coeff,t.width,t.height,'signed')}</div></details>`).join(''):`<p class="muted">No transform calls recorded for mode ${mode}.</p>`;}
select.addEventListener('change',showMode);if(modes.length)showMode();
function treeLines(n,depth=0){if(!n)return '';const pad='  '.repeat(depth),chosen=selected&& !n.split&&n.x===selected.x&&n.y===selected.y&&n.width===selected.width;let s=`${pad}${n.split?'SPLIT':'LEAF'} CU (${n.x},${n.y}) ${n.width}×${n.height}`;if(n.mode)s+=` ${n.mode}${n.intra_dir!==undefined?` mode=${n.intra_dir}`:''} QP=${n.qp}`;if(chosen)s='★ '+s;s+='\n';for(const c of n.children||[])s+=treeLines(c,depth+1);return s;}
document.getElementById('tree').textContent=tree?treeLines(tree):'No CTU_PARTITION event in trace.';
</script></body></html>'''


def find_selected_leaf(node, x, y, size):
    if not isinstance(node, dict):
        return None
    if (not node.get("split") and node.get("x") == x and node.get("y") == y
            and node.get("width") == size and node.get("height") == size):
        return node
    for child in node.get("children", []):
        found = find_selected_leaf(child, x, y, size)
        if found:
            return found
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace", nargs="?", default="tools/intra_probe_dump/trace.jsonl",
                        help="input JSONL trace (default: tools/intra_probe_dump/trace.jsonl)")
    parser.add_argument("-o", "--output", help="HTML report path (default: alongside trace)")
    args = parser.parse_args()

    trace_path = Path(args.trace)
    records = [json.loads(line) for line in trace_path.read_text().splitlines() if line.strip()]
    references = next((r for r in records if r.get("event") == "INTRA_REF_SAMPLES"), None)
    fast_modes = [r for r in records if r.get("event") in ("INTRA_FAST_MODE", "RDO_INTRA_SEARCH") or r.get("event_type") == "INTRA_FAST_MODE"]
    transform_records = [r for r in records if r.get("event") == "TRANSFORM_QUANT"]
    partition = next((r for r in records if r.get("event") == "CTU_PARTITION"), None)

    target = {}
    if references:
        target = {key: references.get(key) for key in
                  ("poc", "ctu_x", "ctu_y", "pu_x", "pu_y", "pu_size")}
    tree_root = None
    if partition:
        tree_root = {key: value for key, value in partition.items() if key == "nodes"}
        nodes = partition.get("nodes", [])
        tree_root = nodes[0] if nodes else None
        if tree_root:
            # Convert the flat HM node list into the quadtree used by the report.
            flat = nodes
            by_key = {(n.get("depth"), n.get("x"), n.get("y")): dict(n, children=[]) for n in flat}
            root = by_key.get((0, partition.get("ctu_x", 0) * partition.get("ctu_size", 0),
                               partition.get("ctu_y", 0) * partition.get("ctu_size", 0)))
            if root is None:
                root = by_key.get((flat[0].get("depth"), flat[0].get("x"), flat[0].get("y")))
            if root:
                for parent in flat:
                    if not parent.get("split"):
                        continue
                    parent_node = by_key[(parent["depth"], parent["x"], parent["y"])]
                    child_depth = parent["depth"] + 1
                    half_w, half_h = parent["width"] // 2, parent["height"] // 2
                    for cx, cy in ((parent["x"], parent["y"]),
                                   (parent["x"] + half_w, parent["y"]),
                                   (parent["x"], parent["y"] + half_h),
                                   (parent["x"] + half_w, parent["y"] + half_h)):
                        child = by_key.get((child_depth, cx, cy))
                        if child:
                            parent_node["children"].append(child)
                tree_root = root

    data = {"target": target, "references": references, "fastModes": fast_modes,
            "transforms": transform_records, "tree": tree_root}
    payload = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    output_path = Path(args.output) if args.output else trace_path.with_name("report.html")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(PAGE.replace("__TRACE_DATA__", payload), encoding="utf-8")
    print(f"Wrote {output_path} ({len(fast_modes)} fast modes, "
          f"{len(transform_records)} transform trials)")


if __name__ == "__main__":
    main()
