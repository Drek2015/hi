# Pull sprites out of reference images: remove background, recover the pixel grid, split sprites.
import sys, json, numpy as np
from PIL import Image
from collections import deque
U='/root/.claude/uploads/2f91f90a-3efa-545a-9c83-ac75e68c5150/'
OUT='ref/'

def prof(a, axis):
    d = np.abs(np.diff(a[...,:3].astype(float), axis=axis)).sum(-1)
    return d.sum(axis=0) if axis==1 else d.sum(axis=1)

def period(p, lo=2.5, hi=40):
    p = p - p.mean(); n=len(p); res=[]
    for T in np.arange(lo, hi, 0.01):
        res.append((abs((p*np.exp(-2j*np.pi*np.arange(n)/T)).sum()), T))
    res.sort(reverse=True); top=res[0][0]
    return max(T for pw,T in res[:400] if pw>0.35*top)

def phase(p, T):
    best=(-1,0)
    for ph in np.arange(0, T, 0.25):
        idx=np.round(np.arange(ph, len(p)-1, T)).astype(int)
        s=p[idx].sum()
        if s>best[0]: best=(s,ph)
    return best[1]

def components(mask, minpx):
    h,w=mask.shape; lab=np.zeros((h,w),int); n=0; out=[]
    for y in range(h):
        for x in range(w):
            if mask[y,x] and not lab[y,x]:
                n+=1; q=deque([(y,x)]); lab[y,x]=n; pts=[]
                while q:
                    cy,cx=q.popleft(); pts.append((cy,cx))
                    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                        ny,nx=cy+dy,cx+dx
                        if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not lab[ny,nx]:
                            lab[ny,nx]=n; q.append((ny,nx))
                if len(pts)>=minpx:
                    ys=[p[0] for p in pts]; xs=[p[1] for p in pts]
                    out.append((min(ys),min(xs),max(ys)+1,max(xs)+1,n))
    return lab,out

def run(name, cfg):
    im=Image.open(U+cfg['file']).convert('RGBA')
    a=np.asarray(im).astype(int)
    if 'crop' in cfg:
        x0,y0,x1,y1=cfg['crop']; a=a[y0:y1,x0:x1]
    R=cfg.get('range',[2.5,40])
    T=cfg.get('T') or (period(prof(a,1),*R)+period(prof(a,0),*R))/2
    px=phase(prof(a,1),T); py=phase(prof(a,0),T)
    xs=np.arange(px+T/2, a.shape[1]-1, T); ys=np.arange(py+T/2, a.shape[0]-1, T)
    g=np.zeros((len(ys),len(xs),4),int)
    for j,y in enumerate(ys):
        for i,x in enumerate(xs):
            r=max(1,int(T*0.2))
            r=max(1,int(T*cfg.get('samp',0.2)))
            blk=a[max(0,int(y)-r):int(y)+r+1, max(0,int(x)-r):int(x)+r+1].reshape(-1,4)
            g[j,i]=np.median(blk,axis=0)
    # background: alpha, or colour of the border cells
    if cfg.get('alpha', a[...,3].min()<128):
        mask=g[...,3]>128
    else:
        border=np.concatenate([g[0],g[-1],g[:,0],g[:,-1]])[:,:3]
        vals,counts=np.unique(border,axis=0,return_counts=True)
        bg=cfg.get('bg') or vals[counts.argmax()]
        near=np.abs(g[...,:3]-np.array(bg)).sum(-1)<=cfg.get('tol',60)
        # Background = bg-coloured cells connected to the border (interior whites survive).
        bgm=np.zeros(near.shape,bool); q=deque()
        h,w=near.shape
        for y in range(h):
            for x in (0,w-1):
                if near[y,x] and not bgm[y,x]: bgm[y,x]=True; q.append((y,x))
        for x in range(w):
            for y in (0,h-1):
                if near[y,x] and not bgm[y,x]: bgm[y,x]=True; q.append((y,x))
        while q:
            cy,cx=q.popleft()
            for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
                ny,nx=cy+dy,cx+dx
                if 0<=ny<h and 0<=nx<w and near[ny,nx] and not bgm[ny,nx]:
                    # follow gradual lighting changes across the backdrop
                    if np.abs(g[ny,nx,:3]-g[cy,cx,:3]).sum()<=cfg.get('step',45):
                        bgm[ny,nx]=True; q.append((ny,nx))
        mask=~bgm
    if cfg.get('skygrass'):
        r,gg,b=g[...,0],g[...,1],g[...,2]
        sky=(b>r+35)&(b>140)
        grass=(gg>r+10)&(gg>b+10)
        dirt=(r>gg+15)&(gg>b+5)&(r<170)&(np.abs(r-gg)<60)
        mask&=~(sky|grass|dirt)
    lab,comps=components(mask, cfg.get('minpx',150))
    res=[]
    for k,(y0,x0,y1,x1,n) in enumerate(sorted(comps,key=lambda c:c[1])):
        s=g[y0:y1,x0:x1].copy().astype(np.uint8)
        s[...,3]=np.where(mask[y0:y1,x0:x1],255,0)
        fn=f'{OUT}{name}_{k}.png'
        Image.fromarray(s,'RGBA').save(fn)
        res.append((fn,s.shape[1],s.shape[0]))
    print(name, 'T=%.2f'%T, res)

CFG=json.load(open('refs.json'))
for name in (sys.argv[1:] or CFG): run(name, CFG[name])
