import json,sys
b=json.load(open('/home/claude/v8/data/beats.json'))
order=[n['id'] for c in json.load(open('/home/claude/v8/data/story.json'))['chapters'] for n in c['steps']]
out=[]
for nid in sys.argv[1].split(','):
    ni=order.index(nid); fr=float(sys.argv[2]) if len(sys.argv)>2 else .75
    for s in b[nid]: out.append(f"{ni}:{round(s['start']+(s['end']-s['start'])*fr,1)}")
print(' '.join(out))
