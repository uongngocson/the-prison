"""Build annotated thumbnail sheets from actual UI evidence; originals stay intact."""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

root=Path('docs/blueprint/evidence/ui-existing-2026-11-02')
out=root/'contact-sheets'
out.mkdir(exist_ok=True)
for run in sorted(root.glob('restart-*')):
    report=run/'results.json'
    if not report.exists():
        continue
    rows=json.loads(report.read_text(encoding='utf-8'))['results']
    devices=sorted({r['device'] for r in rows})
    for device in devices:
        cases=[r for r in rows if r['device']==device and r.get('evidence',{}).get('screenshot')]
        for start in range(0,len(cases),20):
            batch=cases[start:start+20]
            sheet=Image.new('RGB',(1200,1100),'#e8e8e8')
            draw=ImageDraw.Draw(sheet)
            draw.text((12,8),f'{run.name} / {device} / cases {start+1}-{start+len(batch)}',fill='black')
            for i,r in enumerate(batch):
                try:
                    img=Image.open(run/r['evidence']['screenshot']).convert('RGB')
                except (OSError,FileNotFoundError):
                    continue
                img.thumbnail((288,180))
                x=(i%4)*300+(300-img.width)//2
                y=36+(i//4)*210
                sheet.paste(img,(x,y))
                draw.text(((i%4)*300+5,y+182),r['id'],fill='black')
                draw.text(((i%4)*300+5,y+196),r['status'],fill='green' if r['status']=='passed' else 'red')
            sheet.save(out/f'{run.name}-{device}-{start//20+1:02}.jpg',quality=87)
print(str(out))
