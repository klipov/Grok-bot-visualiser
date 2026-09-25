"""Bake the office background and walking sprites. Run with Python + Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance
import random

random.seed(27)
OUT = Path(__file__).resolve().parents[1] / 'public' / 'office'
OUT.mkdir(parents=True, exist_ok=True)
scene=Image.new('RGB',(632,424),'#c3e8ee')
d=ImageDraw.Draw(scene)
def p(x,y,z=0): return (round(295+(x-y)*17),round(55+(x+y)*8.5-z))
def face(points,c): d.polygon(points,fill=c)
def cube(x,y,a,b,h,top,front=None,side=None,z=0):
    front=front or '#ad7956';side=side or '#cf9764'
    face([p(x,y,z),p(x+a,y,z),p(x+a,y,z+h),p(x,y,z+h)],front)
    face([p(x+a,y,z),p(x+a,y+b,z),p(x+a,y+b,z+h),p(x+a,y,z+h)],side)
    face([p(x,y,z+h),p(x+a,y,z+h),p(x+a,y+b,z+h),p(x,y+b,z+h)],top)
def plane(x,y,a,b,c,z=0):face([p(x,y,z),p(x+a,y,z),p(x+a,y+b,z),p(x,y+b,z)],c)
def line(a,b,c,width=1):d.line([a,b],fill=c,width=width)
# The platform is a cutaway diorama, with a small garden outside the office.
cube(-.6,-.6,19.2,16.2,10,'#7fc477','#69935f','#56835f',z=-12)
for i in range(70):
    x=random.uniform(-.5,18.5);y=random.uniform(-.5,15.5)
    if 0<x<18 and 0<y<15:continue
    a,b=p(x,y,-1);d.rectangle((a,b,a+1,b+2),fill='#b7de86')
cube(0,0,18,15,9,'#f8dca7','#d9976d','#e4b57a',z=-9)
for y in range(15):
    for x in range(18):
        plane(x,y,1,1,random.choice(['#f4d9a7','#f7deb2','#f8e3bd','#efd19f']))
        line(p(x,y),p(x+1,y),'#e6c592')
        if (x+y)%3==0:line(p(x+.15,y+.3),p(x+.65,y+.3),'#edcfa0')

cube(0,0,18,.18,44,'#fff5d6','#d3d9bb','#dce6cf')
cube(0,0,.18,15,44,'#fff5d6','#c8d4b5','#e3edcb')
for x in [1.3,7.5,13.8]:
    face([p(x,.2,35),p(x+2.9,.2,35),p(x+2.9,.2,9),p(x,.2,9)],'#577e9a')
    face([p(x+.15,.21,33),p(x+2.7,.21,33),p(x+2.7,.21,11),p(x+.15,.21,11)],'#7ad1e8')
    line(p(x+.3,.21,28),p(x+1.6,.21,28),'#ddf9f4',2)
    line(p(x+1.45,.22,34),p(x+1.45,.22,10),'#fff4cb',2)
    line(p(x,.22,21),p(x+2.9,.22,21),'#fff4cb',2)
    cube(x-.15,.1,3.2,.4,2,'#fff4ce',z=8)

def rug(x,y,a,b,c,edge):
    plane(x,y,a,b,edge,.1);plane(x+.15,y+.15,a-.3,b-.3,c,.2)
    for i in range(round(a*2)):
        line(p(x+i*.5,y,.3),p(x+i*.5,y-.15,.3),edge)
        line(p(x+i*.5,y+b,.3),p(x+i*.5,y+b+.15,.3),edge)
rug(.7,1.2,4.8,4.3,'#a5a0e5','#7c77bd')
rug(6.7,1.2,4.6,4.3,'#8fd5c5','#4b9eaa')
rug(12.6,1.2,4.7,4.3,'#f5b190','#dc8776')
rug(.7,9,5.1,4.8,'#c1dc87','#88aa62')
rug(12,9,5,4.8,'#92cfe4','#629fbf')
# Low dividers keep the walking routes and desk props visible.
for x in (6,12):cube(x,.2,.13,5.5,16,'#fff4d8','#b8c9bd','#dce5ce')

def plant(x,y):
    cube(x,y,.65,.65,7,'#e9ad79','#b66756','#d98762')
    a,b=p(x+.3,y+.3,9)
    for dx,dy,c in [(-6,-4,'#478e66'),(4,-5,'#5da15e'),(0,-10,'#76b76b'),(6,-10,'#88c875'),(-3,-15,'#6bb569')]:
        d.ellipse((a+dx-4,b+dy-4,a+dx+4,b+dy+3),fill=c)
        line((a,b+1),(a+dx,b+dy),'#659659')
def books(x,y,count=5,z=0):
    colors=['#e47e79','#68b5c9','#eec568','#9e90d1','#80af74']
    for k in range(count):
        xx=x+(.06 if k%2 else 0)
        cube(xx,y,.72,.52,2,colors[k%5],'#f9e6bb',colors[k%5],z=z+k*3)
        line(p(xx+.1,y+.53,z+k*3+1),p(xx+.6,y+.53,z+k*3+1),'#dfcca3')
def shelf(x,y):
    cube(x,y,3.5,.65,36,'#e6b77b','#ba8058','#cf9560')
    for z in [5,16,27]:
        face([p(x+.15,y+.67,z),p(x+3.35,y+.67,z),p(x+3.35,y+.67,z+8),p(x+.15,y+.67,z+8)],'#8b6554')
        for k in range(12):
            col=['#db7979','#82b6c5','#c3ca7b','#d6aa67','#9b8bc0'][k%5]
            cube(x+.2+k*.26,y+.69,.2,.07,random.randint(5,8),col,col,col,z=z)
        line(p(x+.1,y+.76,z),p(x+3.4,y+.76,z),'#f1cc93',2)
def chair(x,y,c):
    cube(x,y,.7,.75,7,c,'#57718b','#6c87a0')
    cube(x,y+.55,.7,.16,12,c,'#49667d','#6c87a0',z=6)
def desk(x,y,c='#efc17f'):
    for dx,dy in [(.15,.15),(2.7,.15),(.15,1.3),(2.7,1.3)]:cube(x+dx,y+dy,.15,.15,13,'#cd9b69')
    cube(x,y,3,1.6,3,c,'#b87c55','#d39d65',z=13)
    cube(x+.2,y+1,.7,.45,10,'#edb978','#bc8058','#d99f64',z=2)
    for z in (5,9):line(p(x+.23,y+1.46,z),p(x+.85,y+1.46,z),'#a87354')
def monitor(x,y,z=16):
    cube(x+.3,y+.2,.45,.35,1,'#697b9b',z=z)
    cube(x+.43,y+.3,.12,.12,4,'#7189a6',z=z)
    cube(x,y,1.15,.13,11,'#8fa4be','#526883','#657f9e',z=z+3)
    face([p(x+.1,y+.14,z+12),p(x+1.05,y+.14,z+12),p(x+1.05,y+.14,z+5),p(x+.1,y+.14,z+5)],'#92e7d2')
    for k in range(3):line(p(x+.2,y+.15,z+6+k*2),p(x+.65+(k%2)*.2,y+.15,z+6+k*2),'#489b9f')
    cube(x+.15,y+.85,.95,.4,1,'#edf0d4',z=z)
    for k in range(4):line(p(x+.25+k*.18,y+.9,z+1),p(x+.25+k*.18,y+1.15,z+1),'#a2acae')
# Coordinator: oversized planning board, purple rug, awards and a big desk.
cube(.7,1,3,.25,27,'#eccb8d','#b38d71','#d5ae75')
face([p(.85,1.27,25),p(3.55,1.27,25),p(3.55,1.27,6),p(.85,1.27,6)],'#4c7e79')
for i in range(5):
    xx=1+(i%3)*.75;zz=10+(i//3)*8
    cube(xx,1.29,.5,.03,4,'#f9d58d','#f9d58d','#f9d58d',z=zz)
desk(1.4,2.8);monitor(1.9,2.9)
cube(3.6,3.6,.55,.4,1,'#fff4d5',z=16)
plant(4.8,1.5)

# Research: glassware, an oversized microscope, specimen tanks and notes.
desk(7,2.8,'#d5e9d5');monitor(7.2,2.9)
a,b=p(9.2,3.5,17)
d.ellipse((a-8,b-2,a+8,b+3),fill='#4d7090')
line((a+4,b),(a+4,b-15),'#486b8b',4)
line((a+4,b-15),(a-4,b-22),'#698ca5',5)
line((a-4,b-22),(a-8,b-16),'#3d5979',4)
d.rectangle((a-9,b-5,a+3,b-3),fill='#88acb7')
for xx,cc in [(10.1,'#9be7b1'),(10.65,'#b6a1ec')]:
    cube(xx,1,.4,.4,11,'#bcefe4','#80cbb9',cc,z=12)
    cube(xx+.1,1.1,.2,.2,4,'#edecd0',z=23)
cube(9.8,.8,1.5,.85,12,'#cceade','#8fbfc3','#76c5bf')
chair(8.5,4.7,'#78b4b3')
plant(11,4.7)

# Outreach: a comically big coral telephone and a board full of contacts.
desk(13,2.8,'#ffd39b');monitor(13.1,2.9)
cube(15,3.3,.9,.7,4,'#ed8b88','#b75e71','#d2707d',z=16)
a,b=p(15.4,3.6,24)
line((a-9,b-3),(a+6,b+3),'#b75473',5)
d.ellipse((a-12,b-6,a-6,b),fill='#d96d83');d.ellipse((a+3,b,a+9,b+6),fill='#d96d83')
for k in range(4):d.arc((a+6,b+5+k*3,a+13,b+10+k*3),0,250,fill='#824f71')
for k in range(4):cube(16.4,1+k*.6,.5,.35,3,'#f5e9be',z=0)
plant(17,1)

# Library: tall, individually drawn bookshelves and improbable book stacks.
shelf(.6,9)
shelf(.6,11.8)
desk(2.6,10.3,'#eab582')
books(2.8,10.4,6,16);books(4.5,10.5,3,16)
plane(3.7,11.1,1,.65,'#fff2c9',17)
line(p(4.2,11.1,17),p(4.2,11.75,17),'#c6a47a')
for k in range(3):line(p(3.8,11.2+k*.13,17),p(4.1,11.2+k*.13,17),'#bdae93')
books(5.8,9.8,10);books(6.6,11.2,7);books(5.5,12.4,5)

# Shared lounge and engineering station.
cube(8.1,9.2,2.6,1.4,8,'#ebb567','#bf865a','#dca466')
for x,y in [(8.2,8.5),(10,8.5),(8.2,10.9),(10,10.9)]:chair(x,y,'#ae99d5')
plant(8.8,9.5)
desk(12.7,10.5,'#c3dcea');monitor(12.9,10.6);monitor(14.3,10.6)
cube(16.4,9.8,.8,.9,21,'#6b86aa','#3f5977','#536e90')
for z in [5,10,15]:
    line(p(16.5,10.72,z),p(17.1,10.72,z),'#8ab3cd')
    a,b=p(17,10.73,z);d.point((a,b),fill='#91e5ae')
plant(11.1,13.8);plant(1,14)


scene = ImageEnhance.Color(scene).enhance(1.18)
scene.save(OUT / "office.png")

def draw_bot(color, hair, glasses, frame):
    image = Image.new('RGBA', (32, 40))
    pen = ImageDraw.Draw(image)
    a, b = 15, 35
    pen.ellipse((a-8,b-2,a+9,b+3), fill='#8d927b70')
    step = [0, 2, 0, -2][frame]
    pen.rectangle((a-5,b-6,a-1,b+step), fill='#4e5976')
    pen.rectangle((a+2,b-6,a+6,b-step), fill='#4e5976')
    pen.rectangle((a-6,b+step,a-1,b+step+2), fill='#39475b')
    pen.rectangle((a+2,b-step,a+8,b-step+2), fill='#39475b')
    bob = 1 if frame % 2 else 0
    b -= bob
    pen.rectangle((a-7,b-19,a+6,b-6), fill=color)
    pen.line((a-5,b-17,a-5,b-7), fill='#f5ecc5')
    pen.rectangle((a-9,b-16,a-7,b-9), fill=color)
    pen.rectangle((a+7,b-16,a+9,b-9), fill=color)
    pen.rectangle((a-9,b-9,a-7,b-6), fill='#efb68d')
    pen.rectangle((a+7,b-9,a+9,b-6), fill='#efb68d')
    pen.rectangle((a-5,b-31,a+5,b-20), fill=hair)
    pen.rectangle((a-4,b-27,a+5,b-21), fill='#f5c59e')
    pen.rectangle((a-4,b-31,a+4,b-28), fill=hair)
    pen.point((a-1,b-25), fill='#35445e')
    pen.point((a+4,b-25), fill='#35445e')
    if glasses:
        pen.rectangle((a-3,b-26,a,b-24), outline='#4b4761')
        pen.rectangle((a+2,b-26,a+5,b-24), outline='#4b4761')
    pen.point((a+2,b-22), fill='#cf8f7d')
    return ImageEnhance.Color(image).enhance(1.18)

bots = [
    ('atlas', '#9d83d5', '#75504b', False),
    ('mira', '#58bdb5', '#ad6c46', True),
    ('reed', '#ed8b76', '#5d4850', False),
    ('fern', '#8aaf5e', '#a4594b', True),
    ('kit', '#719fd5', '#4c4b68', False),
]
for name, color, hair, glasses in bots:
    strip = Image.new('RGBA', (128, 40))
    for frame in range(4):
        strip.paste(draw_bot(color, hair, glasses, frame), (frame * 32, 0))
    strip.save(OUT / f'{name}.png')

print(f'Wrote office and five walking sprite strips to {OUT}')
