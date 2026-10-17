/* Browser-side generation; embedded into the standalone report by Python. */
function lotteryFeatures(numbers) {
    const gaps = numbers.slice(1).map((n, i) => n - numbers[i]);
    let run = 1, longest = 1;
    gaps.forEach(g => { run = g === 1 ? run + 1 : 1; longest = Math.max(longest, run); });
    return {sum: numbers.reduce((a,b) => a+b,0), odd: numbers.filter(n=>n%2).length,
        low: numbers.filter(n=>n<=17).length, run:longest,
        small:gaps.filter(g=>g<=2).length, uniform:new Set(gaps).size===1};
}
function hotColdNumbers(draws) {
    const counts=Array(36).fill(0);
    draws.forEach(draw=>draw.main.forEach(n=>counts[n]++));
    const ranked=Array.from({length:35},(_,i)=>i+1).sort((a,b)=>counts[b]-counts[a] || a-b);
    return {hotNumbers:new Set(ranked.slice(0,10)),coldNumbers:new Set(ranked.slice(-10))};
}
function hotColdCounts(numbers, groups) {
    return `${numbers.filter(n=>groups.hotNumbers.has(n)).length}/${numbers.filter(n=>groups.coldNumbers.has(n)).length}`;
}
function lotteryFailures(numbers, f, previous, history) {
    const v = lotteryFeatures(numbers), failures = [];
    if(v.sum<f.minSum || v.sum>f.maxSum) failures.push(`Sum ${v.sum} outside ${f.minSum}–${f.maxSum}`);
    if(f.excludedSums.has(v.sum)) failures.push(`Excluded sum ${v.sum}`);
    if(f.excludedOdd.has(v.odd)) failures.push(`Excluded odd count ${v.odd}`);
    if(f.excludedLow.has(v.low)) failures.push(`Excluded low count ${v.low}`);
    if(v.run>f.maxRun) failures.push(`Consecutive run ${v.run} exceeds ${f.maxRun}`);
    if(v.small>f.maxSmall) failures.push(`Small gaps ${v.small} exceeds ${f.maxSmall}`);
    const overlap=numbers.filter(n=>previous.has(n)).length;
    if(overlap>f.maxOverlap) failures.push(`Latest-draw overlap ${overlap} exceeds ${f.maxOverlap}`);
    if(f.excludeUniform && v.uniform) failures.push('All seven numbers equally spaced');
    if(f.excludeHistory && history.has(numbers.join(','))) failures.push('Main-number set already in history');
    const hot=numbers.filter(n=>f.hotNumbers?.has(n)).length;
    const cold=numbers.filter(n=>f.coldNumbers?.has(n)).length;
    if(hot>(f.maxHot ?? 7))failures.push(`Hot count ${hot} exceeds ${f.maxHot}`);
    if(cold>(f.maxCold ?? 7))failures.push(`Cold count ${cold} exceeds ${f.maxCold}`);
    return failures;
}
function lotteryRandom(seed) {
    if (seed !== '') {
        let state = Number(seed) >>> 0;
        return () => {
            state = (state + 0x6D2B79F5) >>> 0;
            let t = Math.imul(state ^ state >>> 15, 1 | state);
            t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    const buffer = new Uint32Array(256);
    let index = buffer.length;
    return () => {
        if (index === buffer.length) { crypto.getRandomValues(buffer); index = 0; }
        return buffer[index++] / 4294967296;
    };
}
async function generateLottery(draws, f, maxAttempts=f.maxAttempts ?? 20000, sourceGames=null) {
    if(!Number.isInteger(maxAttempts) || maxAttempts<1 || maxAttempts>200000)
        throw Error('Attempt limit must be an integer from 1 to 200000.');
    if(f.minSum>f.maxSum) throw Error('Minimum sum must not exceed maximum sum.');
    if(sourceGames && (sourceGames.length!==5 || sourceGames.some(g=>g.numbers.length!==7) ||
        sourceGames.flatMap(g=>g.numbers).sort((a,b)=>a-b).join(',')!==Array.from({length:35},(_,i)=>i+1).join(',')))
        throw Error('Source games must cover numbers 1–35 exactly once across five games.');
    const sourceSets=sourceGames?.map(g=>new Set(g.numbers));
    f={...hotColdNumbers(draws),...f};
    const previous=new Set(draws[draws.length-1].main), history=new Set(draws.map(d=>d.main.join(',')));
    const random=lotteryRandom(f.seed);
    function randomIndex(length) {
        const limit=Math.floor(4294967296/length)*length;
        let r; do {r=Math.floor(random()*4294967296);} while(r>=limit);
        return r%length;
    }
    let best=null;
    for(let attempt=1;attempt<=maxAttempts;attempt++) {
        if(attempt%250===1) await new Promise(resolve=>setTimeout(resolve,0));
        const shuffled=Array.from({length:35},(_,i)=>i+1);
        for(let i=34;i>0;i--){const j=randomIndex(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
        // Keep the overlap rule mandatory, even when other filters cannot all pass.
        if(sourceSets && Array.from({length:5},(_,i)=>shuffled.slice(i*7,i*7+7))
            .some(game=>sourceSets.some(source=>game.filter(n=>source.has(n)).length>3))) {
            continue;
        }
        const games=[];
        for(let i=0;i<5;i++) {
            const numbers=shuffled.slice(i*7,i*7+7).sort((a,b)=>a-b);
            const failures=lotteryFailures(numbers,f,previous,history);
            games.push({numbers,failures,passed:failures.length===0});
        }
        const passed=games.filter(g=>g.passed).length;
        const violations=games.reduce((total,g)=>total+g.failures.length,0);
        if(!best || passed>best.passed || (passed===best.passed && violations<best.violations))
            best={games,passed,violations};
        if(passed===5) return {...best,attempts:attempt,complete:true};
    }
    if(!best) throw Error('Attempt limit reached without a set meeting the 0–3 overlap rule. Increase the attempt limit or try another seed.');
    return {...best,attempts:maxAttempts,complete:false};
}
function setupLotteryMemory(form, storage, storageKey, note) {
    const fields=Array.from(form.elements).filter(field=>field.name && ['INPUT','SELECT'].includes(field.tagName));
    let messageVersion=0;
    function show(message, hideAfter=0){
        const version=++messageVersion;
        note.textContent=message;
        if(hideAfter) setTimeout(()=>{
            if(version===messageVersion) note.textContent='';
        },hideAfter);
    }
    try {
        const raw=storage.getItem(storageKey);
        if(raw) {
            const saved=JSON.parse(raw);
            if(!saved || saved.version!==1 || typeof saved.values!=='object' || !saved.values)
                throw Error('Invalid saved settings');
            fields.forEach(field=>{
                const value=saved.values[field.name];
                if(field.type==='checkbox' && typeof value==='boolean') field.checked=value;
                else if(field.type!=='checkbox' && typeof value==='string' &&
                    (field.tagName!=='SELECT' || Array.from(field.options).some(option=>option.value===value))) field.value=value;
            });
            show('Saved settings restored. Reset to use this report’s defaults.');
        }
    } catch(error){show('Saved settings could not be restored. Using report defaults.');}
    function save(){
        const values={};
        fields.forEach(field=>{values[field.name]=field.type==='checkbox'?field.checked:field.value;});
        try {
            storage.setItem(storageKey,JSON.stringify({version:1,values}));
            show('Settings saved in this browser.');
        } catch(error){show('Browser storage is unavailable. Settings will not survive a refresh.');}
    }
    form.addEventListener('input',save);
    form.addEventListener('change',save);
    return function reset(){
        form.reset();
        try {
            storage.removeItem(storageKey);
            show('Report defaults restored; saved settings cleared.',5000);
        } catch(error){show('Defaults restored, but browser storage could not be cleared.');}
    };
}
function parseMatchNumbers(text) {
    const tokens=text.trim() ? text.trim().split(/\s+/) : [];
    if(tokens.some(token=>!/^\d+$/.test(token) || Number(token)<1 || Number(token)>35))
        throw Error('Enter main numbers from 1 to 35, separated by spaces.');
    return new Set(tokens.map(Number));
}
function highlightMatchNumbers(root, matches) {
    root.querySelectorAll('[data-match-numbers]').forEach(cell=>{
        const numbers=cell.getAttribute('data-match-numbers').trim().split(/\s+/).map(Number);
        cell.replaceChildren();
        numbers.forEach((number,index)=>{
            if(index)cell.appendChild(document.createTextNode(' '));
            const span=document.createElement('span');
            span.textContent=String(number).padStart(2,'0');
            if(matches.has(number)){
                span.className='matched-number';
                span.setAttribute('aria-label',`${span.textContent}, matched`);
            }
            cell.appendChild(span);
        });
    });
}
// Self-contained so the exact enumeration can run in a Web Worker.
function countLotteryCombinations(draws, f, maxNumber=35) {
    const previous=new Set(draws[draws.length-1].main);
    const history=new Set(draws.map(d=>d.main.join(',')));
    const frequencies=Array(36).fill(0);
    draws.forEach(draw=>draw.main.forEach(n=>frequencies[n]++));
    const ranked=Array.from({length:35},(_,i)=>i+1).sort((a,b)=>frequencies[b]-frequencies[a] || a-b);
    const hotNumbers=new Set(ranked.slice(0,10)),coldNumbers=new Set(ranked.slice(-10));
    const selected=[];
    let count=0;
    function visit(start, sum, odd, low, run, small, overlap, gap, uniform) {
        const remaining=7-selected.length;
        if(sum+remaining*(2*start+remaining-1)/2>f.maxSum ||
           sum+remaining*(2*maxNumber-remaining+1)/2<f.minSum)return;
        if(!remaining) {
            if(f.excludedSums.has(sum) || f.excludedOdd.has(odd) || f.excludedLow.has(low))return;
            if((f.maxHot ?? 7)<7 || (f.maxCold ?? 7)<7) {
                let hot=0,cold=0;
                for(const n of selected){if(hotNumbers.has(n))hot++;if(coldNumbers.has(n))cold++;}
                if(hot>(f.maxHot ?? 7) || cold>(f.maxCold ?? 7))return;
            }
            if(f.excludeUniform && uniform)return;
            if(f.excludeHistory && history.has(selected.join(',')))return;
            count++;return;
        }
        for(let n=start;n<=maxNumber-remaining+1;n++) {
            const difference=selected.length?n-selected[selected.length-1]:0;
            const nextRun=difference===1?run+1:1;
            const nextSmall=small+(difference>0 && difference<=2?1:0);
            const nextOverlap=overlap+(previous.has(n)?1:0);
            if(nextRun>f.maxRun || nextSmall>f.maxSmall || nextOverlap>f.maxOverlap)continue;
            const nextUniform=selected.length<2 || (uniform && difference===gap);
            selected.push(n);
            visit(n+1,sum+n,odd+n%2,low+(n<=17?1:0),nextRun,nextSmall,nextOverlap,difference,nextUniform);
            selected.pop();
        }
    }
    visit(1,0,0,0,0,0,0,0,true);
    return count;
}
function setupLottery(draws) {
    const temperature=hotColdNumbers(draws);
    document.querySelectorAll('.pattern-info-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const open = button.getAttribute('aria-expanded') !== 'true';
            button.setAttribute('aria-expanded', String(open));
            document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
        });
    });
    const form=document.getElementById('lottery-form'), status=document.getElementById('lottery-status');
    const results=document.getElementById('lottery-results'), button=document.getElementById('generate-games');
    const settings=document.getElementById('lottery-settings');
    form.addEventListener('invalid',()=>{settings.open=true;},true);
    const resetButton=document.getElementById('reset-games');
    const memoryNote=document.getElementById('settings-memory-status');
    button.addEventListener('click',()=>{memoryNote.textContent='';});
    // Access to localStorage can be denied, including for local files in some browsers.
    const storage={
        getItem:key=>window.localStorage.getItem(key),
        setItem:(key,value)=>window.localStorage.setItem(key,value),
        removeItem:key=>window.localStorage.removeItem(key)
    };
    const resetSettings=setupLotteryMemory(form,storage,'powerball-engine-settings-v1:'+window.location.pathname,memoryNote);
    const recentCount=document.getElementById('recentDrawCount');
    function updateRecentDraws(){
        const count=Number(recentCount.value);
        document.querySelectorAll('[data-recent-draw]').forEach((row,index)=>{row.hidden=index>=count;});
    }
    recentCount.addEventListener('change',updateRecentDraws);
    updateRecentDraws();
    const matchInput=document.getElementById('matchNumbers'), matchError=document.getElementById('match-error');
    const manualCells=document.querySelectorAll('[data-manual-stat]');
    const manualStatus=document.getElementById('manual-combination-status');
    function updateMatches(){
        let matches=new Set();
        manualCells.forEach(cell=>{cell.textContent='—';});
        manualStatus.textContent='—';manualStatus.removeAttribute('title');
        manualStatus.setAttribute('aria-label','Enter seven distinct numbers to check');
        try{
            matches=parseMatchNumbers(matchInput.value);matchError.textContent='';matchInput.removeAttribute('aria-invalid');
            if(matchInput.value.trim()) {
                const tokens=matchInput.value.trim().split(/\s+/);
                if(matches.size!==7 || tokens.length!==7){
                    matchError.textContent='Enter exactly seven distinct main numbers to show draw statistics.';
                } else {
                    const numbers=Array.from(matches).sort((a,b)=>a-b), v=lotteryFeatures(numbers);
                    const latest=new Set(draws[draws.length-1].main);
                    const overlap=numbers.filter(n=>latest.has(n)).length;
                    [v.sum,`${v.odd}/${7-v.odd}`,`${v.low}/${7-v.low}`,v.run,v.small,overlap,v.uniform?'Yes':'No',hotColdCounts(numbers,temperature)].forEach((value,index)=>{
                        manualCells[index].textContent=value;
                    });
                    try {
                        const filters=readPatternFilters();
                        const history=new Set(draws.map(draw=>draw.main.join(',')));
                        const failures=lotteryFailures(numbers,filters,latest,history);
                        manualStatus.textContent=failures.length?'❌':'✅';
                        const explanation=failures.length?failures.join('; '):'Included in valid combinations: all current filters met.';
                        manualStatus.title=explanation;manualStatus.setAttribute('aria-label',explanation);
                    } catch(error){
                        manualStatus.textContent='—';manualStatus.title=error.message;
                        manualStatus.setAttribute('aria-label','Check settings: '+error.message);
                    }
                }
            }
        }
        catch(error){matchError.textContent=error.message;matchInput.setAttribute('aria-invalid','true');}
        highlightMatchNumbers(document,matches);
    }
    matchInput.addEventListener('input',updateMatches);
    matchInput.addEventListener('keydown',event=>{if(event.key==='Enter')event.preventDefault();});
    updateMatches();
    resetButton.addEventListener('click',()=>{
        resetSettings();
        updateRecentDraws();
        updateMatches();
        results.replaceChildren();status.textContent='';
        document.getElementById('generated-games-heading').hidden=true;
    });
    function integer(name,min,max){
        const raw=form.elements[name].value.trim(), n=Number(raw);
        if(!raw || !Number.isInteger(n) || n<min || n>max)throw Error(`${form.elements[name].labels[0].textContent.trim()}: enter an integer from ${min} to ${max}.`);
        return n;
    }
    function numbers(name,min,max){
        const raw=form.elements[name].value.trim();
        if(!raw || raw.toLowerCase()==='none')return new Set();
        const parts=raw.split(',').map(s=>s.trim());
        if(parts.some(s=>!/^\d+$/.test(s) || Number(s)<min || Number(s)>max))
            throw Error(`${form.elements[name].labels[0].textContent.trim()}: use comma-separated integers from ${min} to ${max}.`);
        return new Set(parts.map(Number));
    }
    function readPatternFilters(){
        const f={...temperature,maxHot:integer('maxHot',0,7),maxCold:integer('maxCold',0,7),minSum:integer('minSum',28,224),maxSum:integer('maxSum',28,224),
            excludedSums:numbers('excludedSums',28,224),excludedOdd:numbers('excludedOdd',0,7),
            excludedLow:numbers('excludedLow',0,7),maxRun:integer('maxRun',1,7),
            maxSmall:integer('maxSmall',0,6),maxOverlap:integer('maxOverlap',0,7),
            excludeUniform:form.elements.excludeUniform.checked,excludeHistory:form.elements.excludeHistory.checked};
        if(f.minSum>f.maxSum)throw Error('Minimum sum must not exceed maximum sum.');
        return f;
    }
    const countOutput=document.getElementById('combination-count');
    let countWorker=null, countTimer=null;
    function updateCombinationCount(){
        clearTimeout(countTimer);
        if(countWorker){countWorker.terminate();countWorker=null;}
        let filters;
        try{filters=readPatternFilters();}
        catch(error){countOutput.value='Check settings';countOutput.title=error.message;return;}
        countOutput.title='Exact number of individual seven-number games meeting the current filters.';
        countOutput.value='Calculating…';
        countTimer=setTimeout(()=>{
            let url;
            try {
                const source='const count='+countLotteryCombinations.toString()+
                    ';onmessage=e=>{try{postMessage({count:count(e.data.draws,e.data.filters)});}catch(error){postMessage({error:error.message});}};';
                url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
                const worker=new Worker(url);countWorker=worker;
                worker.onmessage=event=>{
                    if(countWorker!==worker)return;
                    countOutput.value=event.data.error?'Unable to count':`${event.data.count.toLocaleString()} out of ${(6724520).toLocaleString()}`;
                    if(event.data.error)countOutput.title=event.data.error;
                    worker.terminate();countWorker=null;
                };
                worker.onerror=()=>{
                    if(countWorker!==worker)return;
                    countOutput.value='Unable to count';
                    worker.terminate();countWorker=null;
                };
                worker.postMessage({draws,filters});
            } catch(error){countOutput.value='Counting unavailable';countOutput.title=error.message;}
            finally{if(url)URL.revokeObjectURL(url);}
        },300);
    }
    form.addEventListener('input',event=>{
        if(!['matchNumbers','seed','maxAttempts','recentDrawCount'].includes(event.target.name)){
            updateCombinationCount();updateMatches();
        }
    });
    resetButton.addEventListener('click',updateCombinationCount);
    updateCombinationCount();
    form.addEventListener('submit',async event=>{
        event.preventDefault(); results.replaceChildren(); status.textContent='';
        document.getElementById('generated-games-heading').hidden=false;
        try {
            const seed=form.elements.seed.value.trim();
            if(seed && (!/^\d+$/.test(seed) || Number(seed)>4294967295))throw Error('Seed must be an integer from 0 to 4294967295, or blank.');
            const f={...readPatternFilters(),maxAttempts:integer('maxAttempts',1,200000),seed};
            button.disabled=true; resetButton.disabled=true; status.textContent='Generating games…';
            const result=await generateLottery(draws,f);
            const groups=[result];
            for(let group=1;group<4;group++) {
                status.textContent=`Generating games ${group*5+1}–${group*5+5} from games 1–5…`;
                const groupFilters={...f,seed:f.seed===''?'':String((Number(f.seed)+group)>>>0)};
                groups.push(await generateLottery(draws,groupFilters,f.maxAttempts,result.games));
            }
            const games=groups.flatMap(group=>group.games);
            const table=document.createElement('table');
            table.innerHTML='<thead><tr><th>Status</th><th>Game</th><th>Main numbers</th><th>Sum</th><th>Odd/even</th><th>Low/high</th><th>Longest run</th><th>Small gaps</th><th>Latest-draw overlap</th><th>Equally spaced</th><th>Hot/cold</th><th>Matches with games 1–5</th><th>Filter results</th></tr></thead>';
            const body=document.createElement('tbody');
            const latestNumbers=new Set(draws[draws.length-1].main);
            games.forEach((game,i)=>{
                const v=lotteryFeatures(game.numbers), row=document.createElement('tr');
                const overlap=game.numbers.filter(n=>latestNumbers.has(n)).length;
                [game.passed ? '✓ Pass' : '✗ Fail',i+1,game.numbers.map(n=>String(n).padStart(2,'0')).join('  '),v.sum,`${v.odd}/${7-v.odd}`,`${v.low}/${7-v.low}`,v.run,v.small,overlap,v.uniform?'Yes':'No',hotColdCounts(game.numbers,temperature),i<5?'—':result.games.map(source=>game.numbers.filter(n=>source.numbers.includes(n)).length).join(' / '),game.failures.join('; ') || 'All conditions met'].forEach((value,column)=>{
                    const cell=document.createElement('td');cell.textContent=value;
                    if(column===2)cell.setAttribute('data-match-numbers',game.numbers.join(' '));
                    row.appendChild(cell);
                });row.className=game.passed?'game-pass':'game-fail';body.appendChild(row);
            });table.appendChild(body);results.appendChild(table);
            updateMatches();
            status.textContent=groups.map((group,i)=>`Games ${i*5+1}–${i*5+5}: ${group.passed}/5 pass Settings filters (${group.attempts.toLocaleString()} attempts).`).join(' ') +
                ' Each group uses 1–35 exactly once. Each game 6–20 shares 0–3 numbers with each game 1–5. No Powerball is generated. ' +
                (groups.every(group=>group.complete) ? 'All conditions met.' : 'Attempt limit reached: best sets shown; ✗ rows list unmet Settings filters. The 0–3 overlap rule is always met.');
        } catch(error){status.textContent=error.message;}
        finally{button.disabled=false;resetButton.disabled=false;}
    });
}

setupLottery([{"number": 1144, "date": "2018-04-19", "main": [4, 5, 9, 13, 25, 32, 33], "ball": 7}, {"number": 1145, "date": "2018-04-26", "main": [9, 14, 15, 19, 24, 34, 35], "ball": 12}, {"number": 1146, "date": "2018-05-03", "main": [1, 3, 6, 16, 19, 20, 24], "ball": 13}, {"number": 1147, "date": "2018-05-10", "main": [6, 14, 15, 24, 26, 32, 35], "ball": 14}, {"number": 1148, "date": "2018-05-17", "main": [3, 9, 16, 25, 26, 31, 34], "ball": 9}, {"number": 1149, "date": "2018-05-24", "main": [2, 12, 14, 18, 19, 23, 25], "ball": 17}, {"number": 1150, "date": "2018-05-31", "main": [8, 9, 18, 27, 29, 30, 32], "ball": 6}, {"number": 1151, "date": "2018-06-07", "main": [14, 22, 23, 24, 30, 32, 34], "ball": 9}, {"number": 1152, "date": "2018-06-14", "main": [2, 6, 7, 14, 16, 29, 31], "ball": 15}, {"number": 1153, "date": "2018-06-21", "main": [2, 5, 9, 13, 24, 31, 35], "ball": 16}, {"number": 1154, "date": "2018-06-28", "main": [2, 4, 7, 17, 25, 28, 34], "ball": 3}, {"number": 1155, "date": "2018-07-05", "main": [7, 20, 23, 29, 32, 33, 34], "ball": 16}, {"number": 1156, "date": "2018-07-12", "main": [4, 16, 18, 23, 25, 31, 32], "ball": 5}, {"number": 1157, "date": "2018-07-19", "main": [2, 4, 22, 23, 24, 25, 29], "ball": 17}, {"number": 1158, "date": "2018-07-26", "main": [1, 7, 8, 22, 28, 31, 32], "ball": 15}, {"number": 1159, "date": "2018-08-02", "main": [1, 3, 9, 17, 22, 32, 34], "ball": 19}, {"number": 1160, "date": "2018-08-09", "main": [4, 5, 10, 12, 13, 18, 34], "ball": 19}, {"number": 1161, "date": "2018-08-16", "main": [3, 13, 27, 31, 32, 33, 35], "ball": 3}, {"number": 1162, "date": "2018-08-23", "main": [2, 6, 9, 14, 18, 28, 29], "ball": 11}, {"number": 1163, "date": "2018-08-30", "main": [13, 15, 19, 20, 22, 28, 32], "ball": 20}, {"number": 1164, "date": "2018-09-06", "main": [7, 14, 18, 21, 23, 25, 27], "ball": 20}, {"number": 1165, "date": "2018-09-13", "main": [1, 2, 17, 19, 22, 34, 35], "ball": 11}, {"number": 1166, "date": "2018-09-20", "main": [2, 6, 8, 10, 17, 20, 30], "ball": 8}, {"number": 1167, "date": "2018-09-27", "main": [5, 10, 15, 19, 21, 22, 30], "ball": 3}, {"number": 1168, "date": "2018-10-04", "main": [3, 11, 21, 22, 24, 28, 32], "ball": 7}, {"number": 1169, "date": "2018-10-11", "main": [13, 20, 21, 23, 27, 30, 32], "ball": 13}, {"number": 1170, "date": "2018-10-18", "main": [7, 10, 17, 25, 29, 33, 35], "ball": 5}, {"number": 1171, "date": "2018-10-25", "main": [9, 11, 13, 25, 26, 28, 29], "ball": 12}, {"number": 1172, "date": "2018-11-01", "main": [4, 8, 11, 17, 24, 30, 35], "ball": 3}, {"number": 1173, "date": "2018-11-08", "main": [12, 15, 17, 23, 29, 30, 35], "ball": 10}, {"number": 1174, "date": "2018-11-15", "main": [2, 7, 16, 18, 23, 25, 29], "ball": 20}, {"number": 1175, "date": "2018-11-22", "main": [3, 14, 17, 28, 29, 33, 34], "ball": 17}, {"number": 1176, "date": "2018-11-29", "main": [3, 5, 17, 20, 22, 29, 33], "ball": 12}, {"number": 1177, "date": "2018-12-06", "main": [3, 5, 6, 14, 20, 26, 33], "ball": 19}, {"number": 1178, "date": "2018-12-13", "main": [7, 8, 15, 24, 26, 28, 35], "ball": 13}, {"number": 1179, "date": "2018-12-20", "main": [5, 9, 13, 19, 20, 24, 32], "ball": 15}, {"number": 1180, "date": "2018-12-27", "main": [5, 7, 8, 9, 17, 18, 29], "ball": 19}, {"number": 1181, "date": "2019-01-03", "main": [7, 8, 11, 12, 19, 25, 33], "ball": 13}, {"number": 1182, "date": "2019-01-10", "main": [3, 7, 10, 24, 28, 31, 34], "ball": 14}, {"number": 1183, "date": "2019-01-17", "main": [4, 11, 18, 20, 22, 26, 33], "ball": 9}, {"number": 1184, "date": "2019-01-24", "main": [2, 8, 17, 19, 23, 29, 35], "ball": 3}, {"number": 1185, "date": "2019-01-31", "main": [10, 19, 22, 28, 29, 31, 34], "ball": 10}, {"number": 1186, "date": "2019-02-07", "main": [6, 11, 17, 20, 22, 24, 32], "ball": 19}, {"number": 1187, "date": "2019-02-14", "main": [3, 6, 10, 11, 21, 23, 34], "ball": 5}, {"number": 1188, "date": "2019-02-21", "main": [3, 4, 12, 16, 21, 25, 27], "ball": 8}, {"number": 1189, "date": "2019-02-28", "main": [2, 4, 5, 7, 11, 13, 14], "ball": 14}, {"number": 1190, "date": "2019-03-07", "main": [4, 6, 9, 13, 20, 23, 27], "ball": 2}, {"number": 1191, "date": "2019-03-14", "main": [2, 5, 8, 17, 20, 24, 27], "ball": 6}, {"number": 1192, "date": "2019-03-21", "main": [3, 14, 20, 27, 29, 30, 31], "ball": 7}, {"number": 1193, "date": "2019-03-28", "main": [4, 5, 25, 26, 27, 30, 34], "ball": 18}, {"number": 1194, "date": "2019-04-04", "main": [2, 12, 14, 16, 21, 25, 33], "ball": 4}, {"number": 1195, "date": "2019-04-11", "main": [8, 15, 18, 19, 20, 22, 32], "ball": 9}, {"number": 1196, "date": "2019-04-18", "main": [1, 2, 4, 11, 17, 21, 30], "ball": 2}, {"number": 1197, "date": "2019-04-25", "main": [2, 5, 9, 11, 23, 25, 33], "ball": 6}, {"number": 1198, "date": "2019-05-02", "main": [2, 4, 6, 8, 9, 11, 33], "ball": 4}, {"number": 1199, "date": "2019-05-09", "main": [5, 15, 17, 18, 19, 26, 29], "ball": 2}, {"number": 1200, "date": "2019-05-16", "main": [1, 11, 13, 17, 24, 34, 35], "ball": 19}, {"number": 1201, "date": "2019-05-23", "main": [6, 7, 10, 16, 17, 20, 30], "ball": 4}, {"number": 1202, "date": "2019-05-30", "main": [4, 10, 14, 17, 22, 31, 34], "ball": 7}, {"number": 1203, "date": "2019-06-06", "main": [2, 7, 8, 11, 31, 33, 35], "ball": 20}, {"number": 1204, "date": "2019-06-13", "main": [1, 5, 8, 11, 17, 23, 25], "ball": 3}, {"number": 1205, "date": "2019-06-20", "main": [4, 10, 14, 16, 17, 19, 34], "ball": 13}, {"number": 1206, "date": "2019-06-27", "main": [2, 7, 17, 21, 27, 32, 35], "ball": 7}, {"number": 1207, "date": "2019-07-04", "main": [2, 15, 20, 21, 22, 27, 28], "ball": 3}, {"number": 1208, "date": "2019-07-11", "main": [6, 7, 8, 21, 27, 28, 34], "ball": 16}, {"number": 1209, "date": "2019-07-18", "main": [1, 6, 11, 13, 16, 23, 27], "ball": 11}, {"number": 1210, "date": "2019-07-25", "main": [1, 3, 9, 11, 22, 23, 24], "ball": 4}, {"number": 1211, "date": "2019-08-01", "main": [9, 15, 22, 23, 25, 30, 35], "ball": 6}, {"number": 1212, "date": "2019-08-08", "main": [1, 5, 11, 16, 17, 29, 30], "ball": 8}, {"number": 1213, "date": "2019-08-15", "main": [7, 14, 21, 24, 27, 30, 35], "ball": 13}, {"number": 1214, "date": "2019-08-22", "main": [3, 7, 10, 11, 17, 26, 35], "ball": 19}, {"number": 1215, "date": "2019-08-29", "main": [8, 9, 11, 20, 22, 27, 32], "ball": 20}, {"number": 1216, "date": "2019-09-05", "main": [2, 4, 14, 16, 19, 27, 29], "ball": 13}, {"number": 1217, "date": "2019-09-12", "main": [10, 11, 20, 27, 28, 30, 31], "ball": 2}, {"number": 1218, "date": "2019-09-19", "main": [4, 5, 8, 17, 18, 26, 31], "ball": 9}, {"number": 1219, "date": "2019-09-26", "main": [9, 22, 25, 26, 27, 30, 33], "ball": 19}, {"number": 1220, "date": "2019-10-03", "main": [2, 11, 15, 20, 22, 25, 29], "ball": 3}, {"number": 1221, "date": "2019-10-10", "main": [3, 6, 11, 16, 27, 28, 35], "ball": 10}, {"number": 1222, "date": "2019-10-17", "main": [2, 6, 7, 9, 21, 22, 25], "ball": 12}, {"number": 1223, "date": "2019-10-24", "main": [1, 7, 11, 12, 19, 24, 30], "ball": 7}, {"number": 1224, "date": "2019-10-31", "main": [9, 10, 16, 18, 22, 29, 33], "ball": 8}, {"number": 1225, "date": "2019-11-07", "main": [3, 7, 10, 12, 13, 21, 33], "ball": 4}, {"number": 1226, "date": "2019-11-14", "main": [8, 10, 20, 24, 26, 28, 32], "ball": 6}, {"number": 1227, "date": "2019-11-21", "main": [1, 2, 3, 12, 13, 23, 25], "ball": 1}, {"number": 1228, "date": "2019-11-28", "main": [4, 12, 18, 20, 21, 23, 30], "ball": 1}, {"number": 1229, "date": "2019-12-05", "main": [14, 19, 20, 27, 29, 30, 32], "ball": 6}, {"number": 1230, "date": "2019-12-12", "main": [9, 11, 15, 16, 18, 28, 35], "ball": 9}, {"number": 1231, "date": "2019-12-19", "main": [4, 8, 9, 10, 11, 29, 32], "ball": 18}, {"number": 1232, "date": "2019-12-26", "main": [7, 9, 12, 17, 23, 26, 27], "ball": 2}, {"number": 1233, "date": "2020-01-02", "main": [2, 3, 9, 21, 25, 27, 35], "ball": 4}, {"number": 1234, "date": "2020-01-09", "main": [3, 4, 7, 9, 24, 29, 31], "ball": 2}, {"number": 1235, "date": "2020-01-16", "main": [7, 14, 16, 20, 21, 25, 28], "ball": 11}, {"number": 1236, "date": "2020-01-23", "main": [4, 5, 10, 13, 23, 27, 28], "ball": 4}, {"number": 1237, "date": "2020-01-30", "main": [5, 8, 9, 17, 20, 22, 35], "ball": 16}, {"number": 1238, "date": "2020-02-06", "main": [1, 2, 3, 11, 15, 26, 35], "ball": 17}, {"number": 1239, "date": "2020-02-13", "main": [2, 5, 7, 14, 25, 29, 32], "ball": 3}, {"number": 1240, "date": "2020-02-20", "main": [1, 3, 12, 13, 21, 26, 31], "ball": 19}, {"number": 1241, "date": "2020-02-27", "main": [1, 9, 16, 17, 22, 24, 31], "ball": 2}, {"number": 1242, "date": "2020-03-05", "main": [10, 16, 23, 24, 27, 28, 33], "ball": 12}, {"number": 1243, "date": "2020-03-12", "main": [10, 17, 19, 20, 26, 28, 33], "ball": 2}, {"number": 1244, "date": "2020-03-19", "main": [1, 10, 11, 12, 18, 20, 27], "ball": 20}, {"number": 1245, "date": "2020-03-26", "main": [1, 12, 14, 16, 21, 27, 29], "ball": 7}, {"number": 1246, "date": "2020-04-02", "main": [1, 3, 14, 17, 19, 22, 26], "ball": 18}, {"number": 1247, "date": "2020-04-09", "main": [2, 4, 12, 18, 19, 27, 34], "ball": 11}, {"number": 1248, "date": "2020-04-16", "main": [8, 12, 15, 18, 19, 24, 25], "ball": 18}, {"number": 1249, "date": "2020-04-23", "main": [3, 6, 7, 14, 18, 32, 35], "ball": 2}, {"number": 1250, "date": "2020-04-30", "main": [6, 9, 17, 25, 28, 32, 34], "ball": 10}, {"number": 1251, "date": "2020-05-07", "main": [9, 12, 16, 23, 26, 29, 35], "ball": 10}, {"number": 1252, "date": "2020-05-14", "main": [3, 4, 8, 22, 23, 24, 31], "ball": 15}, {"number": 1253, "date": "2020-05-21", "main": [7, 8, 9, 18, 23, 30, 32], "ball": 4}, {"number": 1254, "date": "2020-05-28", "main": [9, 10, 21, 24, 25, 30, 32], "ball": 19}, {"number": 1255, "date": "2020-06-04", "main": [1, 5, 10, 12, 17, 20, 27], "ball": 13}, {"number": 1256, "date": "2020-06-11", "main": [1, 14, 17, 22, 26, 28, 33], "ball": 9}, {"number": 1257, "date": "2020-06-18", "main": [7, 14, 17, 22, 24, 28, 32], "ball": 1}, {"number": 1258, "date": "2020-06-25", "main": [8, 12, 18, 20, 24, 27, 35], "ball": 17}, {"number": 1259, "date": "2020-07-02", "main": [1, 6, 10, 15, 16, 21, 26], "ball": 19}, {"number": 1260, "date": "2020-07-09", "main": [2, 21, 26, 28, 31, 32, 33], "ball": 12}, {"number": 1261, "date": "2020-07-16", "main": [11, 14, 18, 23, 26, 32, 34], "ball": 5}, {"number": 1262, "date": "2020-07-23", "main": [3, 7, 9, 16, 17, 28, 32], "ball": 6}, {"number": 1263, "date": "2020-07-30", "main": [3, 9, 19, 24, 27, 30, 35], "ball": 1}, {"number": 1264, "date": "2020-08-06", "main": [5, 7, 14, 18, 23, 27, 33], "ball": 7}, {"number": 1265, "date": "2020-08-13", "main": [5, 6, 14, 15, 16, 24, 32], "ball": 19}, {"number": 1266, "date": "2020-08-20", "main": [8, 12, 17, 18, 21, 23, 35], "ball": 1}, {"number": 1267, "date": "2020-08-27", "main": [2, 13, 14, 16, 18, 23, 28], "ball": 9}, {"number": 1268, "date": "2020-09-03", "main": [1, 3, 9, 13, 17, 23, 32], "ball": 19}, {"number": 1269, "date": "2020-09-10", "main": [2, 8, 9, 10, 19, 23, 29], "ball": 14}, {"number": 1270, "date": "2020-09-17", "main": [3, 4, 5, 7, 11, 19, 28], "ball": 6}, {"number": 1271, "date": "2020-09-24", "main": [1, 3, 8, 11, 13, 31, 32], "ball": 3}, {"number": 1272, "date": "2020-10-01", "main": [11, 15, 16, 18, 22, 26, 30], "ball": 4}, {"number": 1273, "date": "2020-10-08", "main": [9, 10, 11, 17, 19, 20, 35], "ball": 3}, {"number": 1274, "date": "2020-10-15", "main": [2, 7, 9, 15, 27, 31, 32], "ball": 7}, {"number": 1275, "date": "2020-10-22", "main": [1, 5, 6, 10, 16, 19, 31], "ball": 10}, {"number": 1276, "date": "2020-10-29", "main": [1, 2, 10, 16, 24, 28, 31], "ball": 19}, {"number": 1277, "date": "2020-11-05", "main": [2, 3, 13, 14, 21, 24, 35], "ball": 12}, {"number": 1278, "date": "2020-11-12", "main": [6, 9, 11, 14, 19, 23, 24], "ball": 20}, {"number": 1279, "date": "2020-11-19", "main": [1, 7, 12, 13, 26, 30, 34], "ball": 11}, {"number": 1280, "date": "2020-11-26", "main": [3, 7, 20, 21, 25, 30, 31], "ball": 2}, {"number": 1281, "date": "2020-12-03", "main": [1, 12, 15, 17, 21, 28, 29], "ball": 17}, {"number": 1282, "date": "2020-12-10", "main": [4, 8, 9, 11, 14, 19, 20], "ball": 19}, {"number": 1283, "date": "2020-12-17", "main": [4, 5, 9, 16, 17, 29, 33], "ball": 13}, {"number": 1284, "date": "2020-12-24", "main": [4, 9, 11, 12, 21, 29, 32], "ball": 2}, {"number": 1285, "date": "2020-12-31", "main": [1, 2, 7, 8, 11, 16, 28], "ball": 7}, {"number": 1286, "date": "2021-01-07", "main": [2, 3, 7, 17, 20, 22, 23], "ball": 5}, {"number": 1287, "date": "2021-01-14", "main": [1, 2, 17, 20, 26, 27, 31], "ball": 14}, {"number": 1288, "date": "2021-01-21", "main": [6, 15, 19, 22, 27, 29, 35], "ball": 14}, {"number": 1289, "date": "2021-01-28", "main": [6, 10, 12, 13, 16, 20, 30], "ball": 11}, {"number": 1290, "date": "2021-02-04", "main": [2, 6, 18, 29, 30, 33, 34], "ball": 8}, {"number": 1291, "date": "2021-02-11", "main": [1, 7, 16, 20, 26, 29, 32], "ball": 14}, {"number": 1292, "date": "2021-02-18", "main": [3, 13, 16, 19, 22, 25, 30], "ball": 10}, {"number": 1293, "date": "2021-02-25", "main": [11, 17, 19, 20, 23, 25, 33], "ball": 3}, {"number": 1294, "date": "2021-03-04", "main": [1, 6, 7, 18, 22, 28, 33], "ball": 4}, {"number": 1295, "date": "2021-03-11", "main": [1, 8, 14, 17, 19, 21, 26], "ball": 20}, {"number": 1296, "date": "2021-03-18", "main": [6, 16, 18, 29, 30, 33, 35], "ball": 4}, {"number": 1297, "date": "2021-03-25", "main": [10, 12, 14, 15, 16, 21, 25], "ball": 5}, {"number": 1298, "date": "2021-04-01", "main": [1, 7, 13, 23, 25, 26, 27], "ball": 15}, {"number": 1299, "date": "2021-04-08", "main": [3, 4, 12, 13, 14, 21, 24], "ball": 6}, {"number": 1300, "date": "2021-04-15", "main": [1, 5, 9, 12, 17, 19, 24], "ball": 3}, {"number": 1301, "date": "2021-04-22", "main": [10, 17, 19, 21, 26, 31, 35], "ball": 1}, {"number": 1302, "date": "2021-04-29", "main": [3, 10, 14, 15, 23, 30, 35], "ball": 15}, {"number": 1303, "date": "2021-05-06", "main": [10, 14, 16, 21, 23, 25, 34], "ball": 9}, {"number": 1304, "date": "2021-05-13", "main": [5, 7, 8, 11, 12, 19, 25], "ball": 20}, {"number": 1305, "date": "2021-05-20", "main": [2, 5, 7, 8, 11, 14, 18], "ball": 19}, {"number": 1306, "date": "2021-05-27", "main": [2, 5, 6, 10, 12, 24, 25], "ball": 20}, {"number": 1307, "date": "2021-06-03", "main": [1, 11, 12, 14, 17, 19, 28], "ball": 11}, {"number": 1308, "date": "2021-06-10", "main": [2, 13, 15, 24, 25, 32, 35], "ball": 16}, {"number": 1309, "date": "2021-06-17", "main": [4, 10, 12, 13, 20, 26, 34], "ball": 1}, {"number": 1310, "date": "2021-06-24", "main": [8, 13, 21, 28, 30, 31, 33], "ball": 15}, {"number": 1311, "date": "2021-07-01", "main": [11, 13, 16, 17, 18, 19, 20], "ball": 15}, {"number": 1312, "date": "2021-07-08", "main": [7, 8, 9, 15, 17, 19, 32], "ball": 6}, {"number": 1313, "date": "2021-07-15", "main": [3, 11, 16, 17, 25, 26, 32], "ball": 2}, {"number": 1314, "date": "2021-07-22", "main": [13, 15, 16, 20, 25, 28, 29], "ball": 11}, {"number": 1315, "date": "2021-07-29", "main": [4, 7, 22, 23, 26, 33, 35], "ball": 17}, {"number": 1316, "date": "2021-08-05", "main": [7, 10, 11, 12, 16, 21, 25], "ball": 18}, {"number": 1317, "date": "2021-08-12", "main": [4, 10, 17, 19, 21, 23, 26], "ball": 7}, {"number": 1318, "date": "2021-08-19", "main": [2, 7, 8, 9, 10, 26, 30], "ball": 3}, {"number": 1319, "date": "2021-08-26", "main": [10, 11, 14, 25, 27, 28, 32], "ball": 6}, {"number": 1320, "date": "2021-09-02", "main": [4, 5, 12, 14, 17, 25, 28], "ball": 10}, {"number": 1321, "date": "2021-09-09", "main": [2, 3, 6, 8, 17, 20, 23], "ball": 2}, {"number": 1322, "date": "2021-09-16", "main": [1, 8, 9, 22, 30, 31, 32], "ball": 9}, {"number": 1323, "date": "2021-09-23", "main": [3, 8, 10, 14, 21, 23, 24], "ball": 5}, {"number": 1324, "date": "2021-09-30", "main": [2, 7, 14, 18, 24, 25, 27], "ball": 20}, {"number": 1325, "date": "2021-10-07", "main": [4, 13, 18, 25, 27, 29, 34], "ball": 13}, {"number": 1326, "date": "2021-10-14", "main": [12, 17, 20, 22, 23, 27, 32], "ball": 17}, {"number": 1327, "date": "2021-10-21", "main": [2, 7, 11, 17, 27, 28, 30], "ball": 11}, {"number": 1328, "date": "2021-10-28", "main": [9, 10, 14, 15, 23, 26, 29], "ball": 3}, {"number": 1329, "date": "2021-11-04", "main": [8, 12, 15, 18, 27, 30, 34], "ball": 8}, {"number": 1330, "date": "2021-11-11", "main": [1, 2, 3, 4, 15, 17, 20], "ball": 16}, {"number": 1331, "date": "2021-11-18", "main": [1, 3, 5, 8, 13, 19, 34], "ball": 11}, {"number": 1332, "date": "2021-11-25", "main": [3, 9, 16, 17, 21, 22, 34], "ball": 9}, {"number": 1333, "date": "2021-12-02", "main": [4, 5, 19, 26, 27, 30, 33], "ball": 8}, {"number": 1334, "date": "2021-12-09", "main": [4, 9, 14, 25, 28, 29, 34], "ball": 3}, {"number": 1335, "date": "2021-12-16", "main": [3, 18, 25, 30, 32, 33, 34], "ball": 6}, {"number": 1336, "date": "2021-12-23", "main": [3, 10, 13, 16, 20, 29, 33], "ball": 19}, {"number": 1337, "date": "2021-12-30", "main": [16, 18, 19, 23, 26, 32, 35], "ball": 10}, {"number": 1338, "date": "2022-01-06", "main": [5, 15, 20, 27, 28, 29, 34], "ball": 8}, {"number": 1339, "date": "2022-01-13", "main": [2, 9, 13, 24, 28, 29, 33], "ball": 13}, {"number": 1340, "date": "2022-01-20", "main": [11, 14, 25, 26, 31, 34, 35], "ball": 1}, {"number": 1341, "date": "2022-01-27", "main": [4, 10, 15, 25, 27, 28, 32], "ball": 18}, {"number": 1342, "date": "2022-02-03", "main": [11, 16, 18, 21, 22, 26, 31], "ball": 8}, {"number": 1343, "date": "2022-02-10", "main": [3, 5, 16, 19, 26, 31, 32], "ball": 6}, {"number": 1344, "date": "2022-02-17", "main": [6, 7, 13, 22, 24, 30, 34], "ball": 10}, {"number": 1345, "date": "2022-02-24", "main": [6, 9, 15, 27, 28, 32, 33], "ball": 8}, {"number": 1346, "date": "2022-03-03", "main": [2, 4, 12, 18, 24, 27, 28], "ball": 4}, {"number": 1347, "date": "2022-03-10", "main": [5, 13, 15, 16, 19, 29, 35], "ball": 16}, {"number": 1348, "date": "2022-03-17", "main": [2, 7, 13, 17, 19, 23, 25], "ball": 13}, {"number": 1349, "date": "2022-03-24", "main": [4, 5, 9, 21, 23, 28, 32], "ball": 20}, {"number": 1350, "date": "2022-03-31", "main": [6, 10, 13, 26, 27, 28, 34], "ball": 11}, {"number": 1351, "date": "2022-04-07", "main": [3, 5, 7, 10, 15, 30, 34], "ball": 12}, {"number": 1352, "date": "2022-04-14", "main": [2, 3, 5, 11, 14, 20, 31], "ball": 4}, {"number": 1353, "date": "2022-04-21", "main": [15, 17, 19, 22, 25, 28, 29], "ball": 6}, {"number": 1354, "date": "2022-04-28", "main": [1, 7, 12, 16, 19, 24, 25], "ball": 7}, {"number": 1355, "date": "2022-05-05", "main": [2, 12, 16, 17, 26, 30, 35], "ball": 19}, {"number": 1356, "date": "2022-05-12", "main": [4, 7, 9, 14, 16, 18, 22], "ball": 10}, {"number": 1357, "date": "2022-05-19", "main": [5, 8, 11, 15, 27, 28, 34], "ball": 3}, {"number": 1358, "date": "2022-05-26", "main": [10, 13, 16, 19, 21, 25, 33], "ball": 18}, {"number": 1359, "date": "2022-06-02", "main": [6, 8, 11, 15, 21, 31, 33], "ball": 7}, {"number": 1360, "date": "2022-06-09", "main": [2, 3, 6, 13, 20, 23, 34], "ball": 12}, {"number": 1361, "date": "2022-06-16", "main": [3, 6, 12, 15, 18, 28, 29], "ball": 15}, {"number": 1362, "date": "2022-06-23", "main": [2, 7, 9, 10, 22, 31, 35], "ball": 19}, {"number": 1363, "date": "2022-06-30", "main": [1, 6, 11, 16, 17, 22, 29], "ball": 2}, {"number": 1364, "date": "2022-07-07", "main": [3, 6, 13, 14, 16, 28, 30], "ball": 11}, {"number": 1365, "date": "2022-07-14", "main": [1, 6, 17, 20, 26, 33, 35], "ball": 5}, {"number": 1366, "date": "2022-07-21", "main": [2, 7, 8, 9, 24, 25, 26], "ball": 9}, {"number": 1367, "date": "2022-07-28", "main": [5, 9, 10, 19, 23, 24, 34], "ball": 13}, {"number": 1368, "date": "2022-08-04", "main": [6, 11, 13, 17, 21, 23, 32], "ball": 15}, {"number": 1369, "date": "2022-08-11", "main": [5, 9, 18, 22, 23, 28, 30], "ball": 3}, {"number": 1370, "date": "2022-08-18", "main": [1, 2, 4, 20, 22, 23, 27], "ball": 20}, {"number": 1371, "date": "2022-08-25", "main": [4, 8, 12, 16, 25, 31, 32], "ball": 17}, {"number": 1372, "date": "2022-09-01", "main": [3, 4, 10, 12, 15, 26, 34], "ball": 20}, {"number": 1373, "date": "2022-09-08", "main": [13, 15, 21, 23, 25, 30, 31], "ball": 10}, {"number": 1374, "date": "2022-09-15", "main": [2, 9, 10, 13, 22, 31, 35], "ball": 15}, {"number": 1375, "date": "2022-09-22", "main": [10, 15, 21, 24, 26, 28, 35], "ball": 8}, {"number": 1376, "date": "2022-09-29", "main": [9, 12, 15, 16, 19, 20, 35], "ball": 4}, {"number": 1377, "date": "2022-10-06", "main": [3, 4, 6, 14, 17, 28, 35], "ball": 10}, {"number": 1378, "date": "2022-10-13", "main": [1, 13, 16, 18, 25, 31, 35], "ball": 2}, {"number": 1379, "date": "2022-10-20", "main": [6, 11, 14, 17, 24, 25, 33], "ball": 18}, {"number": 1380, "date": "2022-10-27", "main": [2, 4, 7, 10, 12, 18, 34], "ball": 7}, {"number": 1381, "date": "2022-11-03", "main": [2, 6, 8, 12, 22, 24, 32], "ball": 2}, {"number": 1382, "date": "2022-11-10", "main": [3, 5, 14, 15, 17, 22, 32], "ball": 7}, {"number": 1383, "date": "2022-11-17", "main": [1, 5, 6, 7, 14, 19, 33], "ball": 17}, {"number": 1384, "date": "2022-11-24", "main": [6, 9, 14, 25, 27, 31, 33], "ball": 15}, {"number": 1385, "date": "2022-12-01", "main": [2, 4, 5, 7, 8, 29, 34], "ball": 15}, {"number": 1386, "date": "2022-12-08", "main": [4, 10, 14, 18, 19, 21, 35], "ball": 11}, {"number": 1387, "date": "2022-12-15", "main": [1, 7, 19, 21, 22, 26, 34], "ball": 2}, {"number": 1388, "date": "2022-12-22", "main": [5, 7, 18, 21, 23, 28, 31], "ball": 4}, {"number": 1389, "date": "2022-12-29", "main": [4, 6, 9, 22, 23, 24, 26], "ball": 18}, {"number": 1390, "date": "2023-01-05", "main": [5, 7, 9, 13, 21, 27, 35], "ball": 6}, {"number": 1391, "date": "2023-01-12", "main": [3, 10, 18, 22, 29, 30, 34], "ball": 5}, {"number": 1392, "date": "2023-01-19", "main": [3, 19, 21, 30, 32, 34, 35], "ball": 1}, {"number": 1393, "date": "2023-01-26", "main": [1, 15, 21, 28, 30, 31, 33], "ball": 16}, {"number": 1394, "date": "2023-02-02", "main": [2, 7, 15, 21, 24, 31, 35], "ball": 18}, {"number": 1395, "date": "2023-02-09", "main": [3, 8, 11, 16, 28, 32, 35], "ball": 13}, {"number": 1396, "date": "2023-02-16", "main": [5, 8, 12, 13, 20, 21, 35], "ball": 8}, {"number": 1397, "date": "2023-02-23", "main": [3, 5, 6, 11, 24, 26, 30], "ball": 9}, {"number": 1398, "date": "2023-03-02", "main": [13, 14, 16, 18, 19, 21, 29], "ball": 18}, {"number": 1399, "date": "2023-03-09", "main": [7, 10, 17, 20, 27, 30, 33], "ball": 1}, {"number": 1400, "date": "2023-03-16", "main": [3, 17, 22, 28, 29, 32, 34], "ball": 18}, {"number": 1401, "date": "2023-03-23", "main": [4, 5, 7, 18, 19, 25, 26], "ball": 15}, {"number": 1402, "date": "2023-03-30", "main": [5, 6, 7, 11, 12, 13, 35], "ball": 15}, {"number": 1403, "date": "2023-04-06", "main": [6, 12, 17, 21, 24, 30, 33], "ball": 10}, {"number": 1404, "date": "2023-04-13", "main": [5, 12, 15, 19, 27, 29, 33], "ball": 4}, {"number": 1405, "date": "2023-04-20", "main": [1, 12, 13, 18, 24, 30, 32], "ball": 6}, {"number": 1406, "date": "2023-04-27", "main": [6, 16, 19, 27, 28, 30, 33], "ball": 17}, {"number": 1407, "date": "2023-05-04", "main": [2, 13, 18, 20, 31, 34, 35], "ball": 9}, {"number": 1408, "date": "2023-05-11", "main": [3, 8, 9, 12, 15, 18, 28], "ball": 14}, {"number": 1409, "date": "2023-05-18", "main": [3, 6, 7, 11, 19, 20, 33], "ball": 18}, {"number": 1410, "date": "2023-05-25", "main": [8, 12, 17, 20, 27, 29, 30], "ball": 6}, {"number": 1411, "date": "2023-06-01", "main": [6, 14, 19, 23, 28, 31, 34], "ball": 3}, {"number": 1412, "date": "2023-06-08", "main": [12, 15, 17, 20, 21, 22, 28], "ball": 11}, {"number": 1413, "date": "2023-06-15", "main": [2, 9, 11, 13, 20, 25, 31], "ball": 2}, {"number": 1414, "date": "2023-06-22", "main": [3, 4, 5, 6, 14, 22, 23], "ball": 17}, {"number": 1415, "date": "2023-06-29", "main": [1, 3, 5, 8, 18, 24, 28], "ball": 2}, {"number": 1416, "date": "2023-07-06", "main": [7, 10, 12, 16, 17, 20, 28], "ball": 20}, {"number": 1417, "date": "2023-07-13", "main": [3, 11, 17, 19, 27, 29, 30], "ball": 15}, {"number": 1418, "date": "2023-07-20", "main": [4, 7, 9, 14, 27, 29, 32], "ball": 17}, {"number": 1419, "date": "2023-07-27", "main": [4, 14, 16, 18, 19, 22, 33], "ball": 18}, {"number": 1420, "date": "2023-08-03", "main": [1, 7, 13, 18, 23, 25, 33], "ball": 7}, {"number": 1421, "date": "2023-08-10", "main": [9, 10, 11, 16, 18, 23, 24], "ball": 9}, {"number": 1422, "date": "2023-08-17", "main": [10, 12, 17, 21, 24, 26, 30], "ball": 10}, {"number": 1423, "date": "2023-08-24", "main": [3, 8, 11, 17, 18, 20, 33], "ball": 7}, {"number": 1424, "date": "2023-08-31", "main": [6, 10, 14, 27, 31, 32, 35], "ball": 6}, {"number": 1425, "date": "2023-09-07", "main": [11, 14, 18, 20, 24, 27, 29], "ball": 19}, {"number": 1426, "date": "2023-09-14", "main": [2, 5, 6, 10, 17, 19, 31], "ball": 10}, {"number": 1427, "date": "2023-09-21", "main": [4, 10, 12, 13, 18, 20, 23], "ball": 5}, {"number": 1428, "date": "2023-09-28", "main": [2, 3, 14, 15, 26, 27, 28], "ball": 19}, {"number": 1429, "date": "2023-10-05", "main": [3, 4, 8, 11, 14, 19, 22], "ball": 5}, {"number": 1430, "date": "2023-10-12", "main": [1, 6, 10, 20, 21, 31, 35], "ball": 13}, {"number": 1431, "date": "2023-10-19", "main": [1, 3, 4, 6, 7, 24, 26], "ball": 18}, {"number": 1432, "date": "2023-10-26", "main": [4, 9, 11, 16, 22, 31, 35], "ball": 20}, {"number": 1433, "date": "2023-11-02", "main": [6, 8, 11, 12, 22, 23, 30], "ball": 15}, {"number": 1434, "date": "2023-11-09", "main": [5, 15, 23, 29, 30, 34, 35], "ball": 2}, {"number": 1435, "date": "2023-11-16", "main": [1, 7, 8, 11, 29, 31, 32], "ball": 16}, {"number": 1436, "date": "2023-11-23", "main": [4, 7, 23, 31, 32, 33, 35], "ball": 5}, {"number": 1437, "date": "2023-11-30", "main": [1, 2, 11, 19, 23, 30, 34], "ball": 4}, {"number": 1438, "date": "2023-12-07", "main": [4, 6, 15, 17, 23, 31, 33], "ball": 15}, {"number": 1439, "date": "2023-12-14", "main": [2, 4, 6, 8, 18, 22, 30], "ball": 2}, {"number": 1440, "date": "2023-12-21", "main": [13, 14, 20, 22, 25, 34, 35], "ball": 12}, {"number": 1441, "date": "2023-12-28", "main": [9, 11, 15, 16, 24, 27, 35], "ball": 1}, {"number": 1442, "date": "2024-01-04", "main": [21, 22, 27, 30, 31, 33, 34], "ball": 4}, {"number": 1443, "date": "2024-01-11", "main": [2, 5, 16, 25, 30, 32, 34], "ball": 7}, {"number": 1444, "date": "2024-01-18", "main": [17, 20, 21, 22, 24, 31, 34], "ball": 6}, {"number": 1445, "date": "2024-01-25", "main": [1, 4, 6, 9, 21, 26, 27], "ball": 10}, {"number": 1446, "date": "2024-02-01", "main": [1, 12, 23, 26, 32, 33, 35], "ball": 10}, {"number": 1447, "date": "2024-02-08", "main": [6, 7, 12, 16, 20, 25, 26], "ball": 2}, {"number": 1448, "date": "2024-02-15", "main": [5, 10, 15, 18, 19, 34, 35], "ball": 20}, {"number": 1449, "date": "2024-02-22", "main": [5, 6, 7, 12, 27, 28, 33], "ball": 4}, {"number": 1450, "date": "2024-02-29", "main": [3, 5, 13, 24, 25, 31, 33], "ball": 17}, {"number": 1451, "date": "2024-03-07", "main": [2, 4, 6, 8, 20, 24, 30], "ball": 10}, {"number": 1452, "date": "2024-03-14", "main": [5, 15, 24, 27, 30, 32, 35], "ball": 2}, {"number": 1453, "date": "2024-03-21", "main": [3, 7, 10, 12, 13, 24, 25], "ball": 11}, {"number": 1454, "date": "2024-03-28", "main": [6, 9, 15, 18, 19, 29, 34], "ball": 4}, {"number": 1455, "date": "2024-04-04", "main": [1, 7, 10, 19, 20, 25, 31], "ball": 11}, {"number": 1456, "date": "2024-04-11", "main": [4, 6, 20, 21, 24, 25, 30], "ball": 2}, {"number": 1457, "date": "2024-04-18", "main": [9, 18, 22, 23, 31, 34, 35], "ball": 1}, {"number": 1458, "date": "2024-04-25", "main": [3, 17, 20, 28, 29, 32, 34], "ball": 18}, {"number": 1459, "date": "2024-05-02", "main": [2, 4, 5, 7, 13, 23, 25], "ball": 16}, {"number": 1460, "date": "2024-05-09", "main": [1, 3, 6, 12, 16, 18, 32], "ball": 4}, {"number": 1461, "date": "2024-05-16", "main": [1, 2, 9, 12, 13, 14, 18], "ball": 3}, {"number": 1462, "date": "2024-05-23", "main": [4, 6, 8, 18, 28, 29, 34], "ball": 11}, {"number": 1463, "date": "2024-05-30", "main": [2, 3, 10, 20, 22, 33, 35], "ball": 9}, {"number": 1464, "date": "2024-06-06", "main": [2, 3, 5, 14, 18, 20, 30], "ball": 4}, {"number": 1465, "date": "2024-06-13", "main": [2, 6, 9, 17, 25, 26, 32], "ball": 4}, {"number": 1466, "date": "2024-06-20", "main": [1, 11, 17, 20, 23, 30, 32], "ball": 16}, {"number": 1467, "date": "2024-06-27", "main": [5, 8, 9, 12, 18, 33, 34], "ball": 6}, {"number": 1468, "date": "2024-07-04", "main": [6, 8, 9, 12, 13, 21, 30], "ball": 4}, {"number": 1469, "date": "2024-07-11", "main": [9, 12, 16, 17, 19, 20, 22], "ball": 9}, {"number": 1470, "date": "2024-07-18", "main": [4, 6, 16, 18, 20, 28, 31], "ball": 6}, {"number": 1471, "date": "2024-07-25", "main": [5, 6, 7, 8, 12, 16, 17], "ball": 13}, {"number": 1472, "date": "2024-08-01", "main": [2, 6, 8, 10, 21, 27, 30], "ball": 9}, {"number": 1473, "date": "2024-08-08", "main": [4, 7, 8, 20, 23, 29, 32], "ball": 17}, {"number": 1474, "date": "2024-08-15", "main": [1, 8, 11, 12, 16, 18, 28], "ball": 15}, {"number": 1475, "date": "2024-08-22", "main": [4, 10, 11, 16, 18, 23, 24], "ball": 6}, {"number": 1476, "date": "2024-08-29", "main": [6, 9, 12, 15, 20, 21, 34], "ball": 15}, {"number": 1477, "date": "2024-09-05", "main": [3, 7, 13, 18, 21, 25, 32], "ball": 18}, {"number": 1478, "date": "2024-09-12", "main": [9, 12, 22, 24, 31, 32, 34], "ball": 10}, {"number": 1479, "date": "2024-09-19", "main": [4, 7, 9, 10, 12, 24, 32], "ball": 15}, {"number": 1480, "date": "2024-09-26", "main": [9, 10, 12, 15, 20, 29, 30], "ball": 16}, {"number": 1481, "date": "2024-10-03", "main": [10, 11, 13, 15, 16, 18, 34], "ball": 2}, {"number": 1482, "date": "2024-10-10", "main": [5, 7, 10, 11, 28, 33, 35], "ball": 1}, {"number": 1483, "date": "2024-10-17", "main": [2, 6, 16, 21, 27, 30, 35], "ball": 7}, {"number": 1484, "date": "2024-10-24", "main": [1, 5, 8, 9, 14, 22, 33], "ball": 2}, {"number": 1485, "date": "2024-10-31", "main": [3, 9, 11, 14, 26, 34, 35], "ball": 7}, {"number": 1486, "date": "2024-11-07", "main": [3, 15, 23, 26, 31, 32, 33], "ball": 6}, {"number": 1487, "date": "2024-11-14", "main": [4, 5, 10, 11, 14, 19, 25], "ball": 20}, {"number": 1488, "date": "2024-11-21", "main": [3, 11, 15, 19, 22, 30, 31], "ball": 2}, {"number": 1489, "date": "2024-11-28", "main": [1, 4, 9, 10, 22, 26, 31], "ball": 14}, {"number": 1490, "date": "2024-12-05", "main": [5, 6, 7, 11, 30, 32, 33], "ball": 11}, {"number": 1491, "date": "2024-12-12", "main": [3, 9, 11, 14, 16, 19, 23], "ball": 16}, {"number": 1492, "date": "2024-12-19", "main": [3, 9, 12, 16, 23, 29, 30], "ball": 19}, {"number": 1493, "date": "2024-12-26", "main": [1, 3, 9, 18, 20, 28, 29], "ball": 9}, {"number": 1494, "date": "2025-01-02", "main": [8, 9, 15, 18, 21, 22, 27], "ball": 19}, {"number": 1495, "date": "2025-01-09", "main": [1, 2, 8, 11, 17, 19, 26], "ball": 11}, {"number": 1496, "date": "2025-01-16", "main": [2, 6, 13, 14, 25, 30, 31], "ball": 2}, {"number": 1497, "date": "2025-01-23", "main": [9, 11, 12, 17, 27, 29, 32], "ball": 18}, {"number": 1498, "date": "2025-01-30", "main": [1, 2, 12, 13, 18, 19, 23], "ball": 4}, {"number": 1499, "date": "2025-02-06", "main": [10, 19, 20, 23, 24, 31, 34], "ball": 14}, {"number": 1500, "date": "2025-02-13", "main": [1, 10, 23, 26, 28, 31, 34], "ball": 3}, {"number": 1501, "date": "2025-02-20", "main": [1, 3, 8, 14, 16, 24, 26], "ball": 4}, {"number": 1502, "date": "2025-02-27", "main": [1, 7, 11, 22, 25, 26, 35], "ball": 3}, {"number": 1503, "date": "2025-03-06", "main": [5, 6, 18, 21, 22, 23, 33], "ball": 16}, {"number": 1504, "date": "2025-03-13", "main": [4, 5, 6, 7, 11, 19, 30], "ball": 20}, {"number": 1505, "date": "2025-03-20", "main": [1, 2, 9, 16, 17, 18, 32], "ball": 1}, {"number": 1506, "date": "2025-03-27", "main": [7, 9, 11, 13, 17, 21, 24], "ball": 11}, {"number": 1507, "date": "2025-04-03", "main": [14, 15, 24, 26, 27, 33, 34], "ball": 10}, {"number": 1508, "date": "2025-04-10", "main": [15, 19, 22, 23, 25, 32, 34], "ball": 2}, {"number": 1509, "date": "2025-04-17", "main": [14, 17, 27, 30, 32, 34, 35], "ball": 17}, {"number": 1510, "date": "2025-04-24", "main": [1, 13, 14, 18, 19, 21, 24], "ball": 13}, {"number": 1511, "date": "2025-05-01", "main": [2, 9, 12, 15, 23, 27, 30], "ball": 10}, {"number": 1512, "date": "2025-05-08", "main": [7, 14, 15, 32, 33, 34, 35], "ball": 12}, {"number": 1513, "date": "2025-05-15", "main": [3, 7, 11, 19, 24, 32, 33], "ball": 17}, {"number": 1514, "date": "2025-05-22", "main": [3, 8, 19, 21, 26, 28, 30], "ball": 20}, {"number": 1515, "date": "2025-05-29", "main": [7, 10, 15, 21, 23, 26, 35], "ball": 18}, {"number": 1516, "date": "2025-06-05", "main": [1, 6, 9, 12, 24, 30, 34], "ball": 10}, {"number": 1517, "date": "2025-06-12", "main": [3, 10, 14, 16, 21, 28, 31], "ball": 6}, {"number": 1518, "date": "2025-06-19", "main": [5, 14, 21, 23, 25, 32, 34], "ball": 11}, {"number": 1519, "date": "2025-06-26", "main": [2, 17, 23, 28, 29, 30, 33], "ball": 15}, {"number": 1520, "date": "2025-07-03", "main": [1, 7, 10, 18, 25, 32, 35], "ball": 14}, {"number": 1521, "date": "2025-07-10", "main": [3, 5, 14, 23, 24, 31, 35], "ball": 10}, {"number": 1522, "date": "2025-07-17", "main": [4, 18, 21, 22, 29, 33, 34], "ball": 3}, {"number": 1523, "date": "2025-07-24", "main": [2, 4, 6, 19, 25, 31, 34], "ball": 20}, {"number": 1524, "date": "2025-07-31", "main": [5, 12, 15, 16, 20, 22, 29], "ball": 4}, {"number": 1525, "date": "2025-08-07", "main": [8, 11, 12, 14, 21, 30, 33], "ball": 19}, {"number": 1526, "date": "2025-08-14", "main": [1, 5, 12, 14, 19, 32, 33], "ball": 10}, {"number": 1527, "date": "2025-08-21", "main": [1, 4, 8, 12, 14, 16, 18], "ball": 14}, {"number": 1528, "date": "2025-08-28", "main": [1, 4, 10, 14, 21, 30, 33], "ball": 6}, {"number": 1529, "date": "2025-09-04", "main": [3, 9, 13, 22, 23, 28, 32], "ball": 5}, {"number": 1530, "date": "2025-09-11", "main": [4, 18, 19, 21, 28, 32, 33], "ball": 17}, {"number": 1531, "date": "2025-09-18", "main": [1, 12, 18, 24, 29, 32, 33], "ball": 8}, {"number": 1532, "date": "2025-09-25", "main": [1, 5, 6, 8, 17, 19, 20], "ball": 12}, {"number": 1533, "date": "2025-10-02", "main": [11, 14, 15, 23, 26, 28, 30], "ball": 9}, {"number": 1534, "date": "2025-10-09", "main": [10, 11, 15, 20, 21, 24, 28], "ball": 20}, {"number": 1535, "date": "2025-10-16", "main": [13, 14, 22, 27, 28, 29, 33], "ball": 16}, {"number": 1536, "date": "2025-10-23", "main": [4, 8, 14, 19, 20, 24, 33], "ball": 16}, {"number": 1537, "date": "2025-10-30", "main": [1, 13, 18, 19, 21, 30, 32], "ball": 17}, {"number": 1538, "date": "2025-11-06", "main": [7, 11, 15, 16, 22, 33, 34], "ball": 13}, {"number": 1539, "date": "2025-11-13", "main": [2, 6, 7, 8, 10, 15, 22], "ball": 13}, {"number": 1540, "date": "2025-11-20", "main": [4, 11, 12, 13, 19, 27, 29], "ball": 20}, {"number": 1541, "date": "2025-11-27", "main": [2, 9, 11, 17, 19, 24, 28], "ball": 1}, {"number": 1542, "date": "2025-12-04", "main": [9, 11, 12, 15, 19, 23, 32], "ball": 14}, {"number": 1543, "date": "2025-12-11", "main": [4, 5, 10, 12, 16, 23, 25], "ball": 10}, {"number": 1544, "date": "2025-12-18", "main": [2, 15, 16, 19, 25, 31, 35], "ball": 14}, {"number": 1545, "date": "2025-12-25", "main": [7, 11, 16, 17, 20, 23, 29], "ball": 17}, {"number": 1546, "date": "2026-01-01", "main": [7, 9, 15, 18, 27, 29, 30], "ball": 3}, {"number": 1547, "date": "2026-01-08", "main": [7, 15, 16, 17, 25, 26, 27], "ball": 9}, {"number": 1548, "date": "2026-01-15", "main": [1, 2, 4, 24, 25, 27, 35], "ball": 14}, {"number": 1549, "date": "2026-01-22", "main": [6, 9, 20, 21, 22, 30, 34], "ball": 5}, {"number": 1550, "date": "2026-01-29", "main": [4, 6, 14, 18, 25, 27, 34], "ball": 6}, {"number": 1551, "date": "2026-02-05", "main": [9, 12, 15, 18, 22, 25, 33], "ball": 8}, {"number": 1552, "date": "2026-02-12", "main": [11, 12, 14, 18, 20, 21, 30], "ball": 7}, {"number": 1553, "date": "2026-02-19", "main": [7, 12, 15, 17, 26, 28, 30], "ball": 9}, {"number": 1554, "date": "2026-02-26", "main": [6, 8, 12, 18, 25, 26, 27], "ball": 5}, {"number": 1555, "date": "2026-03-05", "main": [1, 5, 9, 20, 22, 23, 34], "ball": 17}, {"number": 1556, "date": "2026-03-12", "main": [4, 5, 6, 9, 13, 14, 18], "ball": 14}, {"number": 1557, "date": "2026-03-19", "main": [4, 9, 18, 20, 22, 25, 35], "ball": 15}, {"number": 1558, "date": "2026-03-26", "main": [5, 9, 20, 22, 24, 25, 28], "ball": 20}, {"number": 1559, "date": "2026-04-02", "main": [20, 23, 27, 30, 32, 34, 35], "ball": 18}, {"number": 1560, "date": "2026-04-09", "main": [3, 15, 17, 26, 27, 32, 33], "ball": 20}, {"number": 1561, "date": "2026-04-16", "main": [3, 7, 13, 14, 15, 19, 27], "ball": 18}, {"number": 1562, "date": "2026-04-23", "main": [4, 11, 28, 29, 30, 34, 35], "ball": 3}, {"number": 1563, "date": "2026-04-30", "main": [4, 13, 16, 17, 21, 24, 27], "ball": 17}, {"number": 1564, "date": "2026-05-07", "main": [7, 15, 17, 23, 28, 30, 31], "ball": 18}, {"number": 1565, "date": "2026-05-14", "main": [1, 2, 3, 16, 19, 22, 25], "ball": 18}, {"number": 1566, "date": "2026-05-21", "main": [1, 13, 15, 16, 29, 32, 34], "ball": 6}, {"number": 1567, "date": "2026-05-28", "main": [5, 10, 12, 16, 26, 30, 34], "ball": 11}, {"number": 1568, "date": "2026-06-04", "main": [3, 5, 12, 27, 32, 33, 34], "ball": 10}, {"number": 1569, "date": "2026-06-11", "main": [2, 8, 9, 11, 17, 24, 25], "ball": 18}, {"number": 1570, "date": "2026-06-18", "main": [1, 6, 20, 21, 26, 28, 29], "ball": 19}, {"number": 1571, "date": "2026-06-25", "main": [7, 17, 18, 23, 25, 26, 29], "ball": 16}, {"number": 1572, "date": "2026-07-02", "main": [6, 12, 17, 22, 24, 30, 32], "ball": 2}, {"number": 1573, "date": "2026-07-09", "main": [1, 4, 5, 14, 15, 22, 27], "ball": 18}, {"number": 1574, "date": "2026-07-16", "main": [4, 5, 13, 14, 15, 22, 28], "ball": 13}, {"number": 1575, "date": "2026-07-23", "main": [7, 11, 12, 18, 27, 30, 34], "ball": 16}, {"number": 1576, "date": "2026-07-30", "main": [18, 20, 22, 26, 31, 34, 35], "ball": 18}, {"number": 1577, "date": "2026-08-06", "main": [9, 13, 15, 16, 26, 30, 35], "ball": 7}, {"number": 1578, "date": "2026-08-13", "main": [6, 11, 15, 17, 26, 27, 35], "ball": 11}, {"number": 1579, "date": "2026-08-20", "main": [3, 9, 11, 13, 14, 22, 29], "ball": 20}, {"number": 1580, "date": "2026-08-27", "main": [3, 13, 17, 21, 23, 28, 34], "ball": 11}, {"number": 1581, "date": "2026-09-03", "main": [1, 10, 11, 14, 16, 19, 32], "ball": 11}, {"number": 1582, "date": "2026-09-10", "main": [2, 11, 24, 28, 29, 32, 34], "ball": 13}, {"number": 1583, "date": "2026-09-17", "main": [1, 8, 15, 17, 19, 22, 34], "ball": 2}, {"number": 1584, "date": "2026-09-24", "main": [1, 2, 3, 7, 18, 22, 32], "ball": 12}, {"number": 1585, "date": "2026-10-01", "main": [2, 3, 6, 10, 11, 16, 24], "ball": 14}, {"number": 1586, "date": "2026-10-08", "main": [7, 8, 10, 12, 15, 19, 20], "ball": 7}, {"number": 1587, "date": "2026-10-15", "main": [3, 14, 15, 24, 27, 30, 32], "ball": 16}]);
;

const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectTab(tab) {
    tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
}
tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        selectTab(tabs[next]);
        tabs[next].focus();
    });
});
