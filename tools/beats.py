# 从现有 MP3 中找句内停顿，把每句切成“半句”节拍（只读音频，不改音频）
import json, subprocess, re, sys
import numpy as np
root='/home/claude/longchuang-anim/unpacked/'
man=json.load(open(root+'audio-manifest.json',encoding='utf-8'))
out={}; stats={'ok':0,'fallback':0}
for nid,clip in man.items():
    pcm=subprocess.run(['ffmpeg','-v','quiet','-i',root+'assets/audio/'+nid+'.mp3','-ac','1','-ar','16000','-f','s16le','-'],capture_output=True).stdout
    x=np.frombuffer(pcm,dtype=np.int16).astype(np.float32)/32768
    win=160; n=len(x)//win
    rms=np.sqrt((x[:n*win].reshape(n,win)**2).mean(1)+1e-12); db=20*np.log10(rms)
    sil=db< -42
    sents=[]
    for seg in clip['segments']:
        text=seg['captionText']
        parts=[p for p in re.split(r'(?<=[，、；：])',text) if p.strip()]
        # 合并过短片段（少于 4 个字）到前一段
        merged=[]
        for p in parts:
            if merged and len(re.sub(r'\W','',p))<4: merged[-1]+=p
            else: merged.append(p)
        parts=merged
        a,b=seg['start'],seg['end']
        i0,i1=int(a*100),int(b*100)
        # 句内静音段
        runs=[];k=i0+5
        while k<i1-5:
            if sil[k]:
                j=k
                while j<i1-5 and sil[j]: j+=1
                if j-k>=8: runs.append(((k+j)/2/100,(j-k)/100))
                k=j
            else: k+=1
        need=len(parts)-1
        lens=[len(re.sub(r'\W','',p)) for p in parts]; tot=sum(lens)
        # 期望位置（按字数）
        exp=[];acc=0
        for L in lens[:-1]: acc+=L; exp.append(a+(b-a)*acc/tot)
        cuts=[]
        if need>0 and len(runs)>=need:
            # 每个期望位置取最近的停顿（按长度加权）
            used=set()
            for e in exp:
                best=min((r for r in range(len(runs)) if r not in used),key=lambda r:abs(runs[r][0]-e)-0.3*runs[r][1])
                used.add(best); cuts.append(runs[best][0])
            if all(abs(c-e)<1.2 for c,e in zip(cuts,exp)) and cuts==sorted(cuts): stats['ok']+=1
            else: cuts=exp; stats['fallback']+=1
        elif need>0: cuts=exp; stats['fallback']+=1
        bounds=[a]+cuts+[b]
        sents.append({'start':a,'end':b,'until':seg['displayUntil'],'beats':[{'t0':round(bounds[i],3),'t1':round(bounds[i+1],3),'text':parts[i]} for i in range(len(parts))]})
    out[nid]=sents
json.dump(out,open('/home/claude/v8/work/beats.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(stats)
for s in out['demand-1']:
    print([ (b['t0'],b['text']) for b in s['beats']])
