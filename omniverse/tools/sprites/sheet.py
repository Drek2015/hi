import sys, glob
from PIL import Image, ImageDraw
files=sorted(glob.glob(sys.argv[1]))
cell=150; cols=8
rows=(len(files)+cols-1)//cols
sheet=Image.new('RGB',(cols*cell,rows*(cell+14)),(90,122,176))
d=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
    im=Image.open(f).convert('RGBA')
    k=max(1,min(140//im.width,140//im.height))
    im=im.resize((im.width*k,im.height*k),Image.NEAREST)
    x=(i%cols)*cell; y=(i//cols)*(cell+14)
    sheet.paste(im,(x+(cell-im.width)//2,y+cell-im.height),im)
    d.text((x+2,y+cell),f.split('/')[-1][:24],fill=(255,255,255))
sheet.save(sys.argv[2])
