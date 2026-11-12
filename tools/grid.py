import sys,os
from PIL import Image
prefix,files=sys.argv[1],sys.argv[2:]
ims=[Image.open(f).crop((0,60,1100,640)).resize((550,290)) for f in files if os.path.exists(f)]
rows=(len(ims)+1)//2
W=Image.new('RGB',(1100,290*rows))
for i,im in enumerate(ims): W.paste(im,((i%2)*550,(i//2)*290))
W.save(prefix)
