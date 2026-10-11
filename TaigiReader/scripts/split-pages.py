import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
content = root / 'local-content'
manifest = content / 'series-data.json'
series = json.loads(manifest.read_text(encoding='utf-8-sig'))
count = 0
for book in series['books']:
    for page in book['pages']:
        source = content / page['image'].removeprefix('./')
        with Image.open(source) as image:
            middle = image.width // 2
            for side, bounds in [('left',(0,0,middle,image.height)), ('right',(middle,0,image.width,image.height))]:
                target = source.with_name(source.stem + '-' + side + '.webp')
                image.crop(bounds).save(target, 'WEBP', lossless=True)
                page[side + 'Image'] = './' + target.relative_to(content).as_posix()
            page['splitRatio'] = middle / image.width
        count += 1
manifest.write_text(json.dumps(series, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Split {count} spreads into {count*2} physical page images; originals retained.')
