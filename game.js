
(() => {
  "use strict";

  const canvas = document.getElementById("race");
  const ctx = canvas.getContext("2d");
  const rankingEl = document.getElementById("rankingList");
  const focusModeBtn = document.getElementById("focusModeBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const povSelect = document.getElementById("povSelect");
  let povPlayerIndex=-1;
  const layoutEl = document.querySelector(".layout");
  const broadcastEl = document.querySelector(".broadcast");

  const diagToggle=document.getElementById("diagToggle");
  const diagnostics=document.getElementById("diagnostics");
  const clockEl = document.getElementById("clock");
  const cameraLabel = document.getElementById("cameraLabel");
  const startBtn = document.getElementById("startBtn");
  const restartBtn = document.getElementById("restartBtn");

  const MAP_W = 172, MAP_H = 178;
  const OBSERVER_COUNT = 100;
  const HIT_CHANCE = 1.00;
  const STUN_MS = 0;
  const INV_MS = 0;
  const CAMERA_ZOOM = 3.00;
  const BUILD_ID = "v6.69";
window.__OBSERVER_FM_BUILD__ = BUILD_ID;

  const RACER_KEYS=["A","B","C","D","E","F","G","H"];
  const unitSprites={};
  const unitFiles={1:"scourge",2:"scout",3:"wraith",4:"mutalisk",5:"queen"};
  for(let r=1;r<=5;r++){
    unitSprites[r]={};
    RACER_KEYS.forEach((key,i)=>{
      const img=new Image(); img.src=`${unitFiles[r]}_${String.fromCharCode(97+i)}.png`; unitSprites[r][key]=img;
    });
  }
  // Engine safeguards. Visual sprite size is independent of collision radius.
  const PLAYER_HIT_RADIUS = 0.56;     // v4.07: smaller racer sprite, collision tuned down accordingly
  const PLAYER_VISUAL_SCALE = 0.6583842;  // v4.07: additional -10% from v4.04
  const OBS_VISUAL_SCALE = 0.851598;     // v4.03: +15%
  const OBS_SPEED_RATIO = 0.604314;         // observer speed ≈ 90% of player speed
  const OBS_WANDER_RANGE = 0.88;        // legacy value (not used for full-map roam)
  const OBS_MOVE_MS = 10000;            // move for 10 seconds
  const OBS_STOP_MS = 1000;             // then stop for 1 second
  const AVOID_SCAN_RADIUS = 39.0;        // look ahead for nearby observers
  const AVOID_CRITICAL_RADIUS = 10.8;     // emergency reaction zone
  const AVOID_PREDICT_SEC = 4.10;        // predict observer positions ahead
  const AVOID_REACTION_CHANCE = 0.9995;  // much stronger reaction rate
  const AVOID_SAFE_BUFFER = 7.6;
  const AVOID_LANE_LOOKAHEAD = 3.05;
  const AVOID_HORIZONS = [0.22,0.48,0.82,1.20,1.72,2.35,3.10,3.85];   // compare future lane safety
  const INSIDE_CORNER_STRENGTH = 1.105; // Kart-style inside apex bias
        // extra body-size safety margin
  const ROAD_MARGIN = 1.10;           // outer one-line edge strip is legal air-racing space
  const DEATH_EDGE_EXTRA = 4.50;      // v4.09: lethal zone begins well beyond the real route ribbon
  const ROUTE_PLAN_EXTRA = 0.25;      // planning may use the outer racing rows, but not cut across gaps
  const STUCK_RESCUE_MS = 2200;       // recover from pathological steering states

  const ROUND_UNIT_NAMES={1:"스커지",2:"스카웃",3:"레이스",4:"뮤탈리스크",5:"퀸"};
  const names = ["Angel","Egle","GhostRider","Bacilius","Zino","Chotbul","Kaka","Pika","HongKey","TaeHyeon","DVA","LiveCam"];
  if(povSelect){
    povSelect.innerHTML=`<option value="-1">POV: OFF</option>`+names.map((n,i)=>`<option value="${i}">${n} POV</option>`).join("");
    povSelect.addEventListener("change",()=>{povPlayerIndex=+povSelect.value;});
  }
  const colors = ["#66e3ff","#ffdb66","#ff7a8a","#9b8cff","#72f0a7","#ff9f5c","#f275ff","#b6f06e","#4df0d0","#ffb86b","#7dd3fc","#c4b5fd"];

  // v29: 20 FM-style attributes + individual driving personality.
  // Values are fixed for this build so a player's identity does not reroll on refresh.
  const playerStats = [
    {pace:75,acceleration:95,cornering:82,insideLine:78,routeReading:74,avoidance:83,reaction:91,prediction:96,control:79,stability:98,braking:98,recovery:99,consistency:98,focus:90,aggression:95,riskControl:87,pressure:81,start:97,endurance:79,luck:96}, // Angel
    {pace:78,acceleration:92,cornering:97,insideLine:82,routeReading:94,avoidance:98,reaction:88,prediction:73,control:73,stability:74,braking:85,recovery:77,consistency:81,focus:86,aggression:98,riskControl:94,pressure:75,start:92,endurance:80,luck:96}, // Egle
    {pace:86,acceleration:97,cornering:75,insideLine:79,routeReading:72,avoidance:95,reaction:81,prediction:80,control:73,stability:82,braking:92,recovery:97,consistency:81,focus:95,aggression:75,riskControl:96,pressure:77,start:87,endurance:97,luck:97}, // GhostRider
    {pace:82,acceleration:95,cornering:94,insideLine:97,routeReading:93,avoidance:84,reaction:90,prediction:88,control:93,stability:77,braking:83,recovery:84,consistency:92,focus:72,aggression:85,riskControl:84,pressure:94,start:93,endurance:76,luck:74}, // Bacilius
    {pace:88,acceleration:90,cornering:97,insideLine:74,routeReading:84,avoidance:88,reaction:76,prediction:99,control:93,stability:96,braking:83,recovery:97,consistency:76,focus:84,aggression:97,riskControl:84,pressure:98,start:93,endurance:94,luck:93}, // Zino
    {pace:74,acceleration:97,cornering:91,insideLine:75,routeReading:84,avoidance:84,reaction:76,prediction:88,control:86,stability:98,braking:86,recovery:88,consistency:77,focus:93,aggression:94,riskControl:83,pressure:89,start:94,endurance:77,luck:76}, // Chotbul
    {pace:88,acceleration:94,cornering:74,insideLine:94,routeReading:88,avoidance:91,reaction:78,prediction:99,control:97,stability:95,braking:96,recovery:96,consistency:82,focus:84,aggression:99,riskControl:84,pressure:83,start:96,endurance:86,luck:88}, // Kaka
    {pace:83,acceleration:98,cornering:96,insideLine:98,routeReading:90,avoidance:94,reaction:86,prediction:95,control:80,stability:96,braking:72,recovery:83,consistency:79,focus:88,aggression:90,riskControl:96,pressure:89,start:85,endurance:81,luck:99}, // Pika
    {pace:85,acceleration:91,cornering:89,insideLine:91,routeReading:92,avoidance:90,reaction:88,prediction:93,control:90,stability:89,braking:86,recovery:90,consistency:88,focus:91,aggression:87,riskControl:90,pressure:91,start:89,endurance:88,luck:86}, // HongKey
    {pace:92,acceleration:86,cornering:95,insideLine:88,routeReading:83,avoidance:91,reaction:94,prediction:84,control:87,stability:90,braking:89,recovery:85,consistency:93,focus:88,aggression:82,riskControl:92,pressure:86,start:90,endurance:91,luck:79}, // TaeHyeon
    {pace:80,acceleration:96,cornering:86,insideLine:93,routeReading:90,avoidance:97,reaction:92,prediction:89,control:95,stability:84,braking:94,recovery:92,consistency:80,focus:96,aggression:91,riskControl:88,pressure:93,start:84,endurance:87,luck:90}, // DVA
    {pace:90,acceleration:88,cornering:92,insideLine:85,routeReading:97,avoidance:86,reaction:85,prediction:98,control:88,stability:94,braking:82,recovery:94,consistency:91,focus:95,aggression:84,riskControl:97,pressure:88,start:92,endurance:83,luck:87}, // LiveCam
  ];

  const drivingStyles = [
    {style:"apexHunter",attack:1.1,safety:0.88,pack:1.06}, // Angel
    {style:"safeReader",attack:0.92,safety:1.14,pack:0.96}, // Egle
    {style:"attacker",attack:1.15,safety:0.82,pack:1.1}, // GhostRider
    {style:"lineMaster",attack:1.05,safety:1.02,pack:1.0}, // Bacilius
    {style:"balanced",attack:1.0,safety:1.0,pack:1.0}, // Zino
    {style:"controller",attack:0.94,safety:1.12,pack:0.94}, // Chotbul
    {style:"patient",attack:0.96,safety:1.08,pack:0.97}, // Kaka
    {style:"opportunist",attack:1.08,safety:0.94,pack:1.05}, // Pika
    {style:"balanced",attack:1.02,safety:1.01,pack:1.03}, // HongKey
    {style:"lineMaster",attack:1.04,safety:1.03,pack:1.01}, // TaeHyeon
    {style:"controller",attack:1.01,safety:1.08,pack:1.04}, // DVA
    {style:"safeReader",attack:0.98,safety:1.10,pack:0.99}, // LiveCam
  ];

  // v2.21: stronger behavioral identity; never changes raw base speed.
  // v4.59.5 SMOOTH RECOVERY: keep the survival corridor, suppress stop-stutter further, hold through chained threats, and blend back to pace smoothly.
  // v4.46 RACE-SITUATION AI: leader/chaser/clutch behavior uses Aggression, Risk Control and Pressure.
  // v4.45 PERSONALITY AI 2.0: persistent styles now alter line commitment, safety margin,
  // click rhythm and rejoin patience. They never create random deaths or hidden speed boosts.
  const drivingIdentity={
    apexHunter:{apex:1.18,safety:.94,pass:1.06,patience:.91,control:"zigzag",commit:1.10,evadeWidth:.96,rejoin:1.10},
    safeReader:{apex:.93,safety:1.18,pass:.91,patience:1.18,control:"wide",commit:.91,evadeWidth:1.15,rejoin:.82},
    attacker:{apex:1.08,safety:.90,pass:1.18,patience:.88,control:"zigzag",commit:1.15,evadeWidth:.94,rejoin:1.08},
    lineMaster:{apex:1.17,safety:1.02,pass:1.04,patience:1.02,control:"zigzag",commit:1.11,evadeWidth:1.00,rejoin:1.13},
    balanced:{apex:1,safety:1,pass:1,patience:1,control:"zigzag",commit:1,evadeWidth:1,rejoin:1},
    controller:{apex:.98,safety:1.12,pass:.95,patience:1.08,control:"zigzag",commit:.98,evadeWidth:1.08,rejoin:.94},
    patient:{apex:.95,safety:1.12,pass:.95,patience:1.20,control:"wide",commit:.90,evadeWidth:1.12,rejoin:.84},
    opportunist:{apex:1.10,safety:.96,pass:1.14,patience:.94,control:"zigzag",commit:1.10,evadeWidth:.98,rejoin:1.05}
  };
  function identityOf(p){return drivingIdentity[p.drivingStyle?.style]||drivingIdentity.balanced;}

  // v4.47 UNIT ADAPTATION AI: every chassis asks for a different kind of execution.
  // This is not a hidden unit rating. Compatibility is derived from the same visible
  // 20 FM attributes, so a racer can naturally be excellent on one unit and ordinary on another.
  function unitAdaptationOf(p){
    const st=p.stats||{};
    const n=k=>Math.max(0,Math.min(1,((st[k]??85)-72)/27));
    const avg=(...ks)=>ks.reduce((a,k)=>a+n(k),0)/ks.length;
    switch(currentRound){
      case 1: { // Scourge: twitchy / reactive; rewards reaction + control + acceleration.
        const fit=avg('reaction','control','acceleration');
        return {name:'SCOUT? NO · SCOURGE',fit,safety:.98+(.5-fit)*.05,apex:1.00,click:.90+fit*.08,think:.91,steer:1.08,pace:.997+fit*.006};
      }
      case 2: { // Scout: fast flowing lines; rewards pace + route reading + inside line.
        const fit=avg('pace','routeReading','insideLine');
        return {name:'SCOUT',fit,safety:.97,apex:1.04+fit*.05,click:1.08+fit*.08,think:1.04,steer:.98,pace:.997+fit*.006};
      }
      case 3: { // Wraith: precision/prediction unit; commits early to a read.
        const fit=avg('prediction','focus','routeReading');
        return {name:'WRAITH',fit,safety:1.01+fit*.035,apex:1.02,click:1.00+fit*.06,think:.96,steer:1.01,pace:.997+fit*.006};
      }
      case 4: { // Mutalisk: evasive/aggressive arcs; rewards avoidance + recovery + aggression.
        const fit=avg('avoidance','recovery','aggression');
        return {name:'MUTALISK',fit,safety:1.00+fit*.045,apex:.99,click:.96+fit*.07,think:.93,steer:1.05,pace:.997+fit*.006};
      }
      case 5: { // Queen: deliberate/heavier control; rewards stability + risk control + braking.
        const fit=avg('stability','riskControl','braking');
        return {name:'QUEEN',fit,safety:1.05+fit*.055,apex:.97,click:.94+fit*.06,think:1.06,steer:.94+fit*.04,pace:.997+fit*.006};
      }
      default:return {name:'UNIT',fit:.5,safety:1,apex:1,click:1,think:1,steer:1,pace:1};
    }
  }
  const signatureMoves={apexHunter:{label:"WALL APEX",inside:1.24,skim:1.18},safeReader:{label:"SAFE ARC",inside:.82,skim:1.04},attacker:{label:"THREAD ATTACK",inside:1.08,skim:1.30},lineMaster:{label:"PERFECT LINE",inside:1.30,skim:1.14},balanced:{label:"ADAPTIVE",inside:1,skim:1},controller:{label:"CONTROL CUT",inside:.90,skim:1.06},patient:{label:"WAIT & CUT",inside:.92,skim:1.08},opportunist:{label:"GAP HUNTER",inside:1.16,skim:1.26}};
  function signatureOf(p){return signatureMoves[p.drivingStyle?.style]||signatureMoves.balanced;}


  const profiles = playerStats.map(s => ({
    pace:s.pace,
    line:Math.round((s.cornering+s.insideLine+s.routeReading)/3),
    control:Math.round((s.control+s.stability+s.reaction)/3),
    aggression:s.aggression
  }));

  // v6.04: exact Neon City road-center route; start/goal aligned to original small boxes.
  const route = [
    [31.00,132.50],[55,132.8],[82,132.8],[108,132.8],[128,132.8],
    [128,118],[128,100],[128,84],[128,74],
    [110,74],[92,74],[74,74],[58,74],[44,74],
    [44,60],[44,46],[44,32],[44,23.5],
    [70,23.5],[96,23.5],[122,23.5],[148.65,23.5]
  ];

  // v6.04: road width matches the approved visual; planning is kept inside the road.
  const widths = [14.0,14.0,14.0,14.6,14.6,14.6,14.0,14.6,14.6,14.6,14.0,14.0,14.6,14.6,14.6,14.0,14.6,14.6,14.6,14.0,14.0,14.0];

  const segs = [];
  let routeLength = 0;
  for (let i=0;i<route.length-1;i++){
    const a=route[i], b=route[i+1];
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const L=Math.hypot(dx,dy) || 1;
    segs.push({a,b,dx,dy,L,ux:dx/L,uy:dy/L,nx:-dy/L,ny:dx/L,start:routeLength});
    routeLength += L;
  }

  const map = new Image();
  map.src = "map_v620_only_big_start_goal_corrected.png?v=62001";
  const MAP_IMAGE_SCALE_X=696/172;
  const MAP_IMAGE_SCALE_Y=720/178;

  let players = [];
  let observers = [];
  let running = false;
  let paused = false;
  let pauseStarted = 0;
  let raceStart = 0;
  let lastTs = 0;
  let raf = 0;
  let camX = 28, camY = 158;

  const ROUND_POINTS=[10,7,5,3,2,1,0,-1,-2,-3,-4,-5];
  let currentRound=1;
  let teamAssignments={};
  let activeSourceIndexes=[];
  const INDIVIDUAL_COLORS=["#ff4d4d","#4d8dff","#ffd84d","#39d46a","#66e3ff","#b06cff","#9aa0a6","#ff9f43"];
  let teamTotals={A:0,B:0,C:0,D:0};
  let playerTournament={};
  let roundHistory=[];
  let tournamentHighlights=[];
  let roundTransitioning=false;
  let lastMasterResult=null;

  function clonePlain(v){ return JSON.parse(JSON.stringify(v)); }

  function engineCoreRules(){
    return {build:BUILD_ID,observerCount:OBSERVER_COUNT,playerCount:8,
      playerHitRadius:PLAYER_HIT_RADIUS,stunMs:STUN_MS,invMs:INV_MS,
      cameraZoom:CAMERA_ZOOM,simHz:Math.round(1000/SIM_STEP_MS),
      playerCollision:false,safeZoneInvulnerability:true,
      baseSpeedMultiplier:1.566903319};
  }

  function buildMasterMatchResult(){
    const ratings=aggregateMatchRatings();
    const ratingByIndex=new Map(ratings.map(x=>[x.index,x]));
    const winnerTeam=teamWinner();
    const teamRows=teamStandings();
    const playerResults=names.map((name,index)=>{
      const pt=playerTournament[index]||{rounds:[],total:0,team:teamAssignments[index]||"A"};
      const rows=roundHistory.flatMap(r=>(r.players||[]).filter(x=>x.index===index));
      const mr=ratingByIndex.get(index);
      return {index,name,team:pt.team,totalPoints:pt.total||0,
        matchRating:mr?.rating??null,grade:mr?ratingGrade(mr.rating):null,
        rounds:(pt.rounds||[]).map(rr=>{
          const x=rows.find(v=>v.time===rr.time)||rows.find(v=>v.rating===rr.rating)||null;
          return {round:rr.round,rank:rr.rank,points:rr.points,timeMs:rr.time,rating:rr.rating,
            collisions:x?.collisions??0,overtakes:x?.overtakes??0,avoids:x?.avoids??0,simpleDodges:x?.simpleDodges??0,
            leadMs:x?.leadMs??0,controlAttempts:x?.controlAttempts??0,
            controlSuccesses:x?.controlSuccesses??0,efficiency:x?.efficiency??0,
            raceForm:x?.raceForm??null,startReactionMs:x?.startReactionMs??null,
            startExecution:x?.startExecution??null,bestSector:x?.bestSector??null};
        })};
    });
    return {schema:"observer-fm-race-result@1",build:BUILD_ID,createdAt:new Date().toISOString(),
      rules:engineCoreRules(),match:{rounds:roundHistory.length,
        teamScores:{A:teamTotals.A,B:teamTotals.B,C:teamTotals.C,D:teamTotals.D},winnerTeam,
        margin:teamRows.length>1?Math.max(0,teamRows[0].score-teamRows[1].score):0},
      players:playerResults,
      rounds:roundHistory.map(r=>({round:r.round,team:{A:r.team.A,B:r.team.B,C:r.team.C,D:r.team.D},
        leaderChanges:r.leaderChanges||0,totalOvertakes:r.totalOvertakes||0,
        photoFinish:photoFinishArchive[r.round]?clonePlain(photoFinishArchive[r.round]):null,
        players:(r.players||[]).map(x=>({index:x.index,name:x.name,team:x.team,rank:x.rank,
          points:x.points,timeMs:x.time,rating:x.rating,collisions:x.collisions,deathPoints:clonePlain(x.deathPoints||[]),
          overtakes:x.overtakes,avoids:x.avoids,simpleDodges:x.simpleDodges||0,leadMs:x.leadMs,
          controlAttempts:x.controlAttempts,controlSuccesses:x.controlSuccesses,
          controlByType:clonePlain(x.controlByType||{}),passPlans:clonePlain(x.passPlans||{}),
          insideRate:x.insideRate,extremeInsideRate:x.extremeInsideRate,efficiency:x.efficiency,
          rankGain:x.rankGain,bestSector:x.bestSector,raceForm:x.raceForm,
          startReactionMs:x.startReactionMs,startExecution:x.startExecution}))})),
      highlights:clonePlain(tournamentHighlights),analysis:buildMatchAnalysisReport()};
  }

  function publishMasterResult(){
    lastMasterResult=buildMasterMatchResult();
    window.__OBSERVER_FM_LAST_RESULT__=clonePlain(lastMasterResult);
    window.dispatchEvent(new CustomEvent("observerfm:matchcomplete",{detail:clonePlain(lastMasterResult)}));
    return lastMasterResult;
  }


  function shuffledIndexes(){
    const arr=[0,1,2,3,4,5,6,7,8,9,10,11];
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  function createTeams(){
    activeSourceIndexes=shuffledIndexes().slice(0,8);
    teamAssignments={};
    activeSourceIndexes.forEach((src,pos)=>teamAssignments[pos]=RACER_KEYS[pos]);
  }

  function initTournament(){
    currentRound=1;
    teamTotals={A:0,B:0,C:0,D:0};
    roundHistory=[]; tournamentHighlights=[]; lastMasterResult=null;
    window.__OBSERVER_FM_LAST_RESULT__=null; playerTournament={};
    activeSourceIndexes.forEach((src,i)=>{
      playerTournament[i]={name:names[src],team:RACER_KEYS[i],total:0,rounds:[],sourceIndex:src};
    });
  }

  function teamLabel(team){ return team==="A" ? "빨강팀" : team==="B" ? "파랑팀" : team==="C" ? "노랑팀" : "초록팀"; }

  const TEAM_COLORS={A:"#ff4d4d",B:"#4d8dff",C:"#ffd84d",D:"#39d46a",E:"#66e3ff",F:"#b06cff",G:"#9aa0a6",H:"#ff9f43"};
  function teamColor(team){return TEAM_COLORS[team]||"#ffffff";}
  function teamDotClass(team){return `racer-${String(team).toLowerCase()}`;}
  function teamStandings(){
    return ["A","B","C","D"].map(team=>({team,score:Number(teamTotals[team]||0)}))
      .sort((a,b)=>b.score-a.score||a.team.localeCompare(b.team));
  }
  function teamWinner(){
    const rows=teamStandings();
    return rows.length>1&&rows[0].score===rows[1].score?null:rows[0].team;
  }

  function rebuildTournamentStandings(){
    const totals={A:0,B:0,C:0,D:0};
    const rebuilt={};
    names.forEach((name,i)=>{
      rebuilt[i]={name,team:teamAssignments[i]||"A",total:0,rounds:[]};
    });
    for(const r of roundHistory){
      totals.A+=Number(r.team?.A||0);
      totals.B+=Number(r.team?.B||0);
      totals.C+=Number(r.team?.C||0);
      totals.D+=Number(r.team?.D||0);
      for(const x of (r.players||[])){
        const row=rebuilt[x.index];
        if(!row) continue;
        row.team=x.team;
        row.total+=Number(x.points||0);
        row.rounds.push({
          round:r.round,rank:x.rank,points:x.points,time:x.time,rating:x.rating||0
        });
      }
    }
    teamTotals=totals;
    playerTournament=rebuilt;
  }



  const SAFE_ZONES_620 = {
    start:{x0:21.00,y0:123.00,x1:41.00,y1:142.00},
    goal:{x0:139.00,y0:13.00,x1:158.00,y1:32.00}
  };

  function safeAt(x,y){
    const z=SAFE_ZONES_620;
    return (
      (x>=z.start.x0 && x<=z.start.x1 && y>=z.start.y0 && y<=z.start.y1) ||
      (x>=z.goal.x0 && x<=z.goal.x1 && y>=z.goal.y0 && y<=z.goal.y1)
    );
  }

  function makePlayers(){
    // v4.27 FINAL 8-RACER DIVERSITY: every heat gets a complete spread of stable
    // human racing-line signatures. They still start from the same physical point,
    // but immediately fan into distinct legal lines instead of forming a train.
    // Shuffle once per heat so the behavior belongs to the racer for this race, not a color slot.
    const laneSignatures=[
      {arch:"extremeInside",open:1.00,band:.88,wave:.10},
      {arch:"extremeInside",open:.82,band:.68,wave:-.08},
      {arch:"inside",open:.60,band:.46,wave:.16},
      {arch:"inside",open:.34,band:.24,wave:-.14},
      {arch:"adaptive",open:.08,band:.02,wave:.20},
      {arch:"variant",open:-.24,band:-.28,wave:-.22},
      {arch:"wideCut",open:-.50,band:-.52,wave:.14},
      {arch:"variant",open:-.72,band:-.72,wave:-.12}
    ];
    for(let j=laneSignatures.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[laneSignatures[j],laneSignatures[k]]=[laneSignatures[k],laneSignatures[j]];}
    return activeSourceIndexes.map((src,i)=>{
      const laneSig=laneSignatures[i];
      const name=names[src];
      const pf=profiles[src];
      const stats=playerStats[src];
      const drivingStyle=drivingStyles[src];
      const paceNorm=(pf.pace-90)/10;
      const consistency=(stats.consistency-72)/27;
      const luck=(stats.luck-72)/27;
      const formSpread=.008-consistency*.0035;
      const formRoll=(Math.random()+Math.random()+Math.random()-1.5)/1.5;
      const raceForm=Math.max(.995,Math.min(1.005,1+formRoll*formSpread+(luck-.5)*.001));
      // v2.55: survival-minded racers trade distance for safety.
      const survivalNorm=Math.max(0,Math.min(1,
        (((stats.avoidance+stats.stability+stats.riskControl+stats.prediction)/4)-72)/27));
      // v4.44 STAT FEEL: widen the real gameplay gap between specialists without adding hidden 1v1/8-player ratings.
      const wideDetourRace=false; // v4.67: deliberate exterior detours removed
      const wideDetourSide=Math.random()<.5?-1:1;
      // v4.16: all eight racers start from the exact same physical point.
      // Player-player collision is disabled, so overlapping starts are intentional.
      // Route separation must come from AI decisions after the gun, not spawn offsets.
      const startLane=0;
      return {
        index:i,sourceIndex:src,name,color:INDIVIDUAL_COLORS[i],profile:pf,stats,drivingStyle,team:RACER_KEYS[i],
        raceForm,survivalNorm,wideDetourRace,wideDetourSide,
        visionRadius:Math.max(50,Math.min(64,
          52.0+((stats.prediction-72)/27)*6.0+((stats.reaction-72)/27)*3.5+((stats.focus-72)/27)*3.5)),
        // v2.34: persistent route personality. Negative = safer/wider, positive = tighter inside.
        linePersonality:(
          drivingStyle.style==="apexHunter" ? .92 :
          drivingStyle.style==="attacker" ? .72 :
          drivingStyle.style==="opportunist" ? .58 :
          drivingStyle.style==="lineMaster" ? .42 :
          drivingStyle.style==="balanced" ? .08 :
          drivingStyle.style==="controller" ? -.28 :
          drivingStyle.style==="patient" ? -.62 :
          drivingStyle.style==="safeReader" ? -.82 : 0
        ),
        creativeRouteBudget:.52, creativeRouteUsed:0, creativeMode:0,
        // v4.193: persistent route archetype. Racers share the fast macro route but
        // deliberately prefer different legal micro-lines. This is stable per racer,
        // not frame-by-frame random jitter.
        routeArchetype:laneSig.arch,
        routeArchetypeStrength:.84+Math.random()*.16,
        // v4.194: opening-line identity. The fast opening macro-line remains known,
        // but racers no longer all stack on it: some climb to the extreme inside,
        // some hold a middle-high band, and some deliberately run a lower variant.
        openingLineBias:laneSig.open,
        openingLineStrength:.91+Math.random()*.09,
        creativeModeUntil:0, creativeCooldown:900+Math.random()*1200,
        creativeSide:Math.random()<.5?-1:1, creativePhase:Math.random()*Math.PI*2,
        routeIdentityBias:Math.max(-.78,Math.min(.78,(Math.random()*1.20-.60)+(drivingStyle.attack-drivingStyle.safety)*.42)),
        routeIdentityPhase:Math.random()*Math.PI*2,
        laneSignatureWave:laneSig.wave,
        // v4.02: personal route band. High route-reading racers stay closer to the
        // calculated racing line; lower route-reading / safety-oriented racers use
        // visibly different legal bands. Avoidance still has final authority.
        routeBand:(()=>{
          const read=(stats.routeReading-72)/27;
          const inside=(stats.insideLine-72)/27;
          const safety=((stats.riskControl+stats.stability)/2-72)/27;
          const style=(drivingStyle.attack-drivingStyle.safety);
          const identity=(Math.random()*2-1)*(0.34-read*0.08);
          // v4.27: signature is the anchor; stats/style bend it without collapsing
          // eight racers back onto one mathematical optimum.
          return Math.max(-1.02,Math.min(1.02,laneSig.band*.66+identity+inside*.18+style*.20-safety*.10));
        })(),
        routeBandPhase:Math.random()*Math.PI*2,
        // v4.10: rare/high-skill extreme-inside attempts. Success can create a huge
        // shortest-line gain; a misjudged attempt deliberately crosses the lethal edge.
        extremeInsideActive:false, extremeInsideFail:false, extremeInsideUntil:0,
        extremeInsideCooldown:900+Math.random()*1200, extremeInsideSide:0,
        skimDodgeCooldown:0,
        liveRatingHistory:[],lastRatingSampleAt:0,
        x:31.05, y:132.55,
        steerX:1, steerY:0,
        seg:0,
        // Pace creates small but meaningful differences, not runaway gaps.
        speed: (
          9.43
          + paceNorm*0.105
          + ((stats.acceleration-85)/14)*0.028
          + ((stats.consistency-85)/14)*0.016
          + ((stats.endurance-85)/14)*0.012
          + ((stats.luck-85)/14)*0.0015
          + Math.random()*0.006
        ) * 1.566903319,
        desiredOffset:(i-3.5)*0.40,
        stunUntil:0, invUntil:0, collisionLockUntil:0,
        hitFxUntil:0, visualAngle:0, prevX:31.05, prevY:132.55, simPrevX:31.05, simPrevY:132.55,
        // v4.69: brief tolerance for borderline upper-left corner exits.
        outsideGrace69Since:0,
        sectorIndex:0, sectorStartMs:0, sectorTimes:[],
        humanMode:0, humanModeUntil:0, humanPhase:Math.random()*Math.PI*2,
        decisionErrorUntil:0, textWidth:0,
        hits:0, dead:false, done:false, finishTime:null,
        controlMode:"normal", controlUntil:0,
        backconStyle:"none",
        controlCooldown: 2400 + Math.random()*3600,
        reactiveControl:false,
        reactiveThreatId:-1,
        reactiveControlCooldown:1800+Math.random()*2200,
        controlSuccess:true,
        controlQuality:1,
        controlMistakeSide:0,
        modeStart:0,
        lastProgress:0,
        lastAdvanceAt:0,
        lastX:31.05,
        lastY:132.55,
        avoidDecisionUntil:0,
        avoidWillDodge:true,
        avoidThreatId:-1,
        avoidPlanOffset:0,
        avoidPlanSpeedMul:1,
        avoidPlanUntil:0,
        avoidPlanRisk:0,
        avoidLastSide:0,
        avoidSideLockUntil:0,
        avoidRecoverUntil:0,
        avoidRecoverOffset:0,
        avoidRecoverStart:0,
        avoidExitSide:0,
        avoidExitUntil:0,
        avoidClearSince:0,
        // v4.17 human-like live controller: short-lived mouse-style inputs,
        // reaction delay and repeated re-reads of the visible observer field.
        liveEvadeUntil:0, liveEvadeNextThink:0, liveEvadeOffset:0, liveEvadeSpeed:1,
        liveEvadeSide:0, liveEvadePhase:0, liveEvadeDanger:0, liveEvadeThreat:-1,
        liveEvadeAction:"none",
        evadeRevisionThreat:-1, evadeRevisionVx:0, evadeRevisionVy:0, evadeRevisionAt:0, evadeRevisionCooldown:0,
        // v4.28 survival balance: hold a safe escape lane briefly after a threat clears
        // instead of snapping straight back into the racing line / next observer.
        survivalRecoverUntil:0, survivalRecoverStart:0, survivalRecoverOffset:0,
        // v4.33 rejoin safety gate: do not snap back into the apex while the next
        // observer corridor is still closing.
        survivalRejoinClearSince:0, survivalRejoinHoldUntil:0, survivalRejoinLastRisk:0,
        // v4.34 boxed/blocked escape: remember one committed breakout corridor so
        // front-left-right pressure does not cause panic oscillation or repeated stops.
        breakoutUntil:0, breakoutOffset:0, breakoutSpeed:1, breakoutSide:0, breakoutScore:0,
        // v4.20 Virtual Mouse Human Controller. Movement follows a held click target
        // until the next human-timed command instead of consuming a fresh perfect target every tick.
        mouseTargetX:30.77, mouseTargetY:144.00, mouseNextThink:0, mouseCommandUntil:0,
        mouseClickSeq:0, mouseClickLog:[], mouseMode:"race", mouseLastClickAt:0,
        // v4.59.9 AI DEATH BLACKBOX: 5-second rolling decision/perception trace.
        aiBlackbox:[], aiBlackboxNextSample:0,
        // v4.26 persistent human click rhythm. Each racer keeps a recognizable
        // command tempo, click reach and risk/rejoin character instead of sharing
        // one global mouse cadence. Stable for the race; never frame-randomized.
        mouseRhythm:({apexHunter:.88,safeReader:1.12,attacker:.84,lineMaster:.94,balanced:1.00,controller:.91,patient:1.15,opportunist:.87}[drivingStyle.style]||1)*(0.96+Math.random()*.08),
        mouseReach:({apexHunter:1.05,safeReader:.91,attacker:1.07,lineMaster:1.02,balanced:.97,controller:.94,patient:.90,opportunist:1.04}[drivingStyle.style]||1)*(0.985+Math.random()*.03),
        mouseDangerTempo:({apexHunter:.92,safeReader:.88,attacker:.84,lineMaster:.94,balanced:1.00,controller:.86,patient:1.05,opportunist:.87}[drivingStyle.style]||1),
        mouseRejoinBias:identityOf({drivingStyle}).rejoin,
        // v4.21 perception: only personally seen observers may drive AI decisions.
        perceivedObservers:new Map(), perceptionLastUpdate:0, perceptionFocusId:-1,
        // v4.37 humanized perception. Stable personal bias + repeat-sighting confidence
        // create believable late/rough reads without frame-randomized fake deaths.
        perceptionBiasX:(Math.random()-.5)*0.34, perceptionBiasY:(Math.random()-.5)*0.34,
        perceptionTrackSeed:Math.random()*1000,
        // v4.23 human reaction pipeline: detection -> recognition -> decision -> click.
        reactionThreatId:-1, reactionDangerActive:false, mouseReactionReadyAt:0,
        lastReactionDelayMs:0, lastRecognitionDelayMs:0,
        aiDiagRedundantClicks:0, aiDiagLastMode:"race", aiDiagModeChanges:0,
        variantMode:0,
        variantUntil:0,
        variantCooldown:6500+Math.random()*7000,
        variantSide:0,
        variantStrength:0,
        tacticalRisk:0,
        tacticalRiskUntil:0,
        tacticalRiskCooldown:900+Math.random()*900,
        situationDecisionUntil:0,
        situationDecisionOffset:0,
        packPlanOffset:0,
        packPlanUntil:0,
        // v4.66 MULTI-CAR RACING LINE 2.0: short commitment prevents pack weaving.
        multiCarLineOffset:0,
        multiCarLineUntil:0,
        multiCarLineMode:"solo",
        passPlanMode:0,       // 0 none, 1 inside attack, 2 outside setup, 3 wait-and-cut
        passPlanUntil:0,
        passPlanCooldown:700+Math.random()*900,
        passPlanOffset:0,
        passPlanSpeedMul:1,
        passTargetId:-1,
        startLaunchMul:0,
        startLaunchUntil:0,
        startReactionMs:0,
        startExecution:1,
        // v4.48 START AI: same physical spawn, different committed opening decisions.
        startLineTarget:0, startLineCommit:0, startDecisionUntil:0, startBurstPhase:0,
        livePressure:0,
        newPB:false,
        newMapRecord:false,
        clutchDecisionUntil:0,
        clutchLineOffset:0,
        clutchSpeedMul:1,
        decisionLockUntil:0,
        decisionLockOffset:0,
        comboDodgeUntil:0,
        comboDodgeOffset:0,
        comboDodgePhase:0,
        comboDodgeSide:0,
        preCornerUntil:0,
        preCornerOffset:0,
        finalCornerUntil:0,
        finalCornerOffset:0,
        shockAvoidUntil:0,
        shockAvoidOffset:0,
        marseilleUntil:0,
        marseilleSide:0,
        resumeEaseUntil:0,
        // v2.54: uninterrupted running builds a small momentum advantage.
        // A stop/reverse/collision resets it, so cleaner runs edge ahead on equal lines.
        continuousRunMs:0,
        continuousRunMul:1,
        // v2.60: collision-free confidence. It affects route bravery, not raw speed.
        cleanConfidenceMs:0,
        cleanConfidence:0,
        match:{
          collisions:0,stops:0,avoids:0,simpleDodges:0,packDodges:0,overtakes:0,leadMs:0,
          nearMisses:0,extremeNearMisses:0,lastNearMissAt:0,dangerExposureMs:0,
          deathPoints:[],
          controlAttempts:0,controlSuccesses:0,
          controlByType:{
            zigzag:{attempts:0,successes:0},
            diagonal:{attempts:0,successes:0},
            spin360:{attempts:0,successes:0},
            marseille:{attempts:0,successes:0},
            backcon:{attempts:0,successes:0},
            stopcon:{attempts:0,successes:0},
            wide:{attempts:0,successes:0}
          },
          passPlans:{inside:0,outside:0,waitCut:0,straight:0},
          lineSamples:0,insideHits:0,extremeInsideHits:0,
          trace:[],lastTraceAt:0,
          maxRankGain:0,maxRankLoss:0,startRank:i+1,bestRank:i+1,worstRank:i+1,
          distance:0,lastX:route[0][0],lastY:route[0][1]
        },
        linePlanOffset:0,
        linePlanUntil:0
      };
    });
  }

  function pickObserverLeg(o){
    const legSeconds=OBS_MOVE_MS/1000;
    const legDistance=o.speed*legSeconds;
    const margin=3.5;

    // Choose a straight heading whose 10-second endpoint remains inside the map.
    // This guarantees a visibly large movement leg instead of circling locally.
    let angle=0, found=false;
    for(let tries=0;tries<40;tries++){
      angle=Math.random()*Math.PI*2;
      const ex=o.x+Math.cos(angle)*legDistance;
      const ey=o.y+Math.sin(angle)*legDistance;
      if(ex>=margin && ex<=MAP_W-margin && ey>=margin && ey<=MAP_H-margin){
        found=true;
        break;
      }
    }

    if(!found){
      // Near awkward edges, aim roughly toward a distant interior point.
      const tx=MAP_W*(0.25+Math.random()*0.50);
      const ty=MAP_H*(0.25+Math.random()*0.50);
      angle=Math.atan2(ty-o.y,tx-o.x);
    }

    o.vx=Math.cos(angle)*o.speed;
    o.vy=Math.sin(angle)*o.speed;
  }


  let observerDensityZones=[];
  function makeObserverDensityZones(){
    const count=2+Math.floor(Math.random()*2);
    const zones=[];
    for(let i=0;i<count;i++){
      zones.push({
        x:18+Math.random()*(MAP_W-36),
        y:16+Math.random()*(MAP_H-32),
        rx:20+Math.random()*20,
        ry:16+Math.random()*18,
        strength:.28+Math.random()*.18,
        trap:false
      });
    }
    // v3.1 옵저버 함정 구간: 매 라운드 실제 코스 위 1~2곳에 작은 밀집 구간.
    // 옵저버는 스폰 후 기존처럼 독립적으로 랜덤 이동하므로 코스를 따라다니지 않는다.
    const trapCount=1+(Math.random()<.45?1:0);
    const trapCandidates=[6,9,13,18,22,27,31];
    for(let i=0;i<trapCount;i++){
      const ri=trapCandidates[Math.floor(Math.random()*trapCandidates.length)];
      const pt=route[Math.min(route.length-1,ri)];
      zones.push({
        x:pt[0],y:pt[1],
        rx:7.5+Math.random()*3.5,ry:6.0+Math.random()*3.0,
        strength:.72,trap:true
      });
    }
    return zones;
  }
  function densitySpawnPoint(){
    // Most observers remain globally random. A bounded share is biased into
    // 2–3 random zones each round, so the dangerous area changes without
    // turning observers into course-followers.
    if(observerDensityZones.length && Math.random()<.48){
      const traps=observerDensityZones.filter(z=>z.trap);
      const z=(traps.length&&Math.random()<.34)
        ? traps[Math.floor(Math.random()*traps.length)]
        : observerDensityZones[Math.floor(Math.random()*observerDensityZones.length)];
      for(let tries=0;tries<10;tries++){
        const a=Math.random()*Math.PI*2, rr=Math.sqrt(Math.random());
        const x=z.x+Math.cos(a)*z.rx*rr;
        const y=z.y+Math.sin(a)*z.ry*rr;
        if(x>3.5&&x<MAP_W-3.5&&y>3.5&&y<MAP_H-3.5) return {x,y};
      }
    }
    return {x:3.5+Math.random()*(MAP_W-7),y:3.5+Math.random()*(MAP_H-7)};
  }

  function spawnObservers(){
    const arr=[];
    const avgPlayerSpeed=9.72;
    const baseSpeed=avgPlayerSpeed*OBS_SPEED_RATIO;
    observerDensityZones=makeObserverDensityZones();

    for(let i=0;i<OBSERVER_COUNT;i++){
      const spawn=densitySpawnPoint();
      const o={
        id:i,
        x:spawn.x,
        y:spawn.y,
        vx:0, vy:0,
        speed:baseSpeed*(0.98+Math.random()*0.04),
        phase:"move",
        phaseUntil:0,
        // Stagger phases so 650 observers do not stop simultaneously.
        cycleOffset:Math.random()*(OBS_MOVE_MS+OBS_STOP_MS)
      };
      pickObserverLeg(o);
      arr.push(o);
    }
    return arr;
  }

  function resetRound(){
    cancelAnimationFrame(raf);
    replayFrames=[]; replayLastCapture=0; highlightMarkers=[];
    broadcastStoryKey="";broadcastStoryUntil=0;broadcastTickerUntil=0;broadcastTickerText="";
    broadcastLastRankSnapshot=new Map();
    players=makePlayers();
    players.forEach(forceStartCenter625);
    observers=spawnObservers();
    running=false;
    raceStart=0; lastTs=0; lastRankingRender=0; simClock=0; simAccumulator=0; simTickCounter=0;
    lastLeaderName=""; raceEventText=""; raceEventUntil=0; bestSector=[null,null,null];
    broadcastFocusId=-1; broadcastFocusUntil=0; previousUiRanks=new Map();
    cameraLeaderId=-1; cameraLeaderHoldUntil=0;
    raceFrameCache668={stamp:-1,active:[],leader:null,top:[]};
    players.forEach(p=>{p._personality657=null;p._reaction646=null;p._stab648=null;p._overtake642Until=0;p._overtake642TargetId=-1;sanitizeRaceState666(p);});
    diagFrames=0; diagFps=0; diagLastFpsTs=0; diagFrameMs=0; diagMaxFrameMs=0;
    fpsProtectLevel=0; fpsLowSince=0; fpsGoodSince=0; raceLeaderChanges=0; raceTotalOvertakes=0; lastCloseBattleKey=""; lastCloseBattleEventAt=0;
    seasonRecorded=false; prevRanks=new Map();
    camX=31.05; camY=132.55;
    roundTransitioning=false;
    startBtn.textContent=`${currentRound}R 시작`;
    render(0);
    renderRanking();
    renderTeamScore();
    renderRecordBoard();
  }

  function reset(){
    replayFrames=[]; replayLastCapture=0; replayPlaying=false; replayCursor=0;
    replaySpeed=1; replayLastTs=0; replayFocusId=-1;
    replayArchive={}; highlightArchive={}; photoFinishArchive={}; replaySelectedRound=1;

    createTeams();
    initTournament();
    resetRound();
  }

  function currentProgress(p){
    if(p.done) return routeLength+1000-(p.finishTime||0)/1000000;
    const s=segs[Math.min(p.seg,segs.length-1)];
    const along=((p.x-s.a[0])*s.ux+(p.y-s.a[1])*s.uy);
    return s.start + Math.max(0,Math.min(s.L,along));
  }

  function shiftObjectTimers(obj,delta){
    if(!obj||!delta)return;
    for(const k of Object.keys(obj)){
      const v=obj[k];
      if(typeof v==="number" && v>0 && /(Until|At|Cooldown)$/.test(k)) obj[k]=v+delta;
    }
  }

  function togglePause(){
    if(!running || !raceStart) return;
    if(!paused){
      paused=true;
      pauseStarted=performance.now();
      cancelAnimationFrame(raf);
      if(pauseBtn){pauseBtn.textContent="▶ 계속";pauseBtn.classList.add("paused");}
      render(pauseStarted);
      return;
    }
    const now=performance.now();
    paused=false;
    // v3.33: simClock is the authoritative race clock. It does not advance while
    // paused, so gameplay timers must NOT be shifted by real-world pause duration.
    pauseStarted=0;
    lastTs=now;
    simAccumulator=0;
    if(pauseBtn){pauseBtn.textContent="⏸ 일시정지";pauseBtn.classList.remove("paused");}
    raf=drawDebugHud519(ctx);
    requestAnimationFrame(loop);
  }

  function start(){
    if(running) return;
    paused=false;
    if(pauseBtn){pauseBtn.textContent="⏸ 일시정지";pauseBtn.classList.remove("paused");}
    if(players.every(p=>p.done)) return;
    running=true;
    const now=performance.now();
    if(!raceStart){
      players.forEach(forceStartCenter625);
      raceStart=now;
      // v2.43: LIVE commentary UI removed.
      // v2.14: each racer gets a small stat-driven launch quality.
      // This is a start skill effect, not comeback rubber-banding.
      for(let i=0;i<players.length;i++){
        const p=players[i];
        const start=(p.stats.start-72)/27;
        const reaction=(p.stats.reaction-72)/27;
        const accel=(p.stats.acceleration-72)/27;
        const focus=(p.stats.focus-72)/27;
        const pressure=(p.stats.pressure-72)/27;
        const consistency=(p.stats.consistency-72)/27;
        const skill=(start*.34+reaction*.25+accel*.16+focus*.13+pressure*.12);

        // v2.7 explicit start reaction: 0.045–0.220 s.
        const reactionNoise=(Math.random()-.5)*(46-consistency*14);
        p.startReactionMs=Math.max(45,Math.min(220,
          170-reaction*14-focus*9-start*10-pressure*6+reactionNoise*.32-(p.raceForm-1)*45));
        p.startExecution=Math.max(.960,Math.min(1.040,
          .994+skill*.016+(p.raceForm-1)*.07+(Math.random()-.5)*(.004-consistency*.0012)));

        // Opening lane is derived from the persistent route signature + driving personality.
        // No spawn offset is used: everyone physically starts at the current yellow-box center x=31.05,y=132.55.
        const half0=Math.max(2.0,widths[0]*.66);
        const id=identityOf(p);
        const styleBias=(id.apex-1)*.34+(id.pass-1)*.20-(id.safety-1)*.18;
        const signature=(p.openingLineBias||0)*.78+(p.routeBand||0)*.22+styleBias;
        const controlN=(p.stats.control-72)/27;
        // v4.62 OPENING FAST-LINE: the start fan is no longer allowed to waste the
        // long first approach on the slow/outside half. Read the first real corner
        // from route geometry and place every racer in a small skill/personality band
        // around that corner's fastest inside approach. Diversity remains, but it is
        // diversity around a good racing line rather than random upper/lower spreading.
        const openingSide=Math.sign(openingInsideBias(0))||1;
        const openingSkill=Math.max(0,Math.min(1,((p.stats.routeReading+p.stats.insideLine+p.stats.cornering)/3-72)/27));
        const microBand=Math.max(-.16,Math.min(.16,signature*.10+(p.index%3-1)*.018));
        const fastStartNorm=Math.max(.64,Math.min(.94,.72+openingSkill*.14+start*.05+microBand));
        p.startLineTarget=openingSide*half0*fastStartNorm;
        p.startLineCommit=Math.max(.76,Math.min(1,.80+start*.08+reaction*.06+controlN*.05));
        p.startDecisionUntil=now+2050+start*330+reaction*170;
        p.startBurstPhase=Math.max(0,Math.min(1,skill));

        const jitter=(Math.random()-.5)*(.014-consistency*.0045);
        p.startLaunchMul=Math.max(.958,Math.min(1.052,.992+skill*.024+jitter*.30+(p.raceForm-1)*.06));
        p.startLaunchUntil=now+2050+accel*260+start*180;
      }
    }
    lastTs=now;
    simClock=now; simAccumulator=0;
    try{
      rebuildObserverGrid();
      precomputeObserverPredictions(now);
      startBtn.textContent="진행 중";
      raf=requestAnimationFrame(loop);
    }catch(err){
      running=false;
      startBtn.textContent=`${currentRound}R 시작`;
      console.error("[Observer Avoid FM] start failed",err);
      throw err;
    }
  }

  function controlPreferenceWeights(p){
    // v2.11: each driving identity favors different manual-control choices.
    const name=p.drivingStyle.style;
    let w={zigzag:1.12,backcon:1.12,stopcon:.035,wide:1};
    if(name==="apexHunter")      w={zigzag:1.18,backcon:1.22,stopcon:.72,wide:.76};
    else if(name==="safeReader")w={zigzag:.84,backcon:.62,stopcon:1.48,wide:1.20};
    else if(name==="attacker")  w={zigzag:1.34,backcon:1.38,stopcon:.58,wide:.72};
    else if(name==="lineMaster")w={zigzag:.92,backcon:.88,stopcon:.86,wide:1.30};
    else if(name==="controller")w={zigzag:1.16,backcon:1.04,stopcon:1.22,wide:.82};
    else if(name==="patient")   w={zigzag:.78,backcon:.66,stopcon:1.34,wide:1.26};
    else if(name==="opportunist")w={zigzag:1.24,backcon:1.34,stopcon:.76,wide:.88};
    const id=identityOf(p);
    if(id.control && w[id.control]!=null && id.control!=="stopcon") w[id.control]*=1.16;
    // v2.51: stopcon is an emergency last resort only.
    w.stopcon*=.035; // v4.50: stop-control is now an exceptional emergency-only move
    w.zigzag*=1.34;
    w.backcon*=.34;
    return w;
  }

  function weightedControlPick(p,allowed){
    const w=controlPreferenceWeights(p);
    let total=0;
    for(let i=0;i<allowed.length;i++) total+=w[allowed[i]]||1;
    let r=Math.random()*total;
    for(let i=0;i<allowed.length;i++){
      r-=w[allowed[i]]||1;
      if(r<=0) return allowed[i];
    }
    return allowed[allowed.length-1];
  }

  function beginControl(p,mode,now,duration,reactive,threatId=-1,backconStyleHint=null){
    p.controlMode=mode;
    p.reactiveControl=reactive;
    p.reactiveThreatId=threatId;
    p.modeStart=now;
    p.controlUntil=now+duration;
    // v2.61: two visible back-control techniques.
    // LONG = meaningful reverse then forward burst; TAP = tiny reverse tap then instant forward.
    if(mode==="backcon"){
      p.backconStyle=(backconStyleHint==="long"||backconStyleHint==="tap")
        ? backconStyleHint
        : (Math.random()<.52?"long":"tap");
      if(p.backconStyle==="long") p.controlUntil=now+Math.max(duration,420+Math.random()*170);
      else p.controlUntil=now+Math.min(duration,220+Math.random()*90);
    }else{
      p.backconStyle="none";
    }

    const control=(p.stats.control-72)/27;
    const reaction=(p.stats.reaction-72)/27;
    const stability=(p.stats.stability-72)/27;
    const focus=(p.stats.focus-72)/27;
    const pressure=(p.stats.pressure-72)/27;

    // Failure means imperfect execution/time loss, never an intentional collision.
    let base=.78 + control*.075 + reaction*.055 + stability*.045 + focus*.025;
    if(reactive) base-=.035; // emergency controls are harder to execute cleanly
    if(mode==="backcon") base-=.045;
    else if(mode==="zigzag") base-=.018;
    else if(mode==="stopcon") base+=.045;
    base+=pressure*.018;
    base+=(p.raceForm-1)*.42;
    const successChance=Math.max(.65,Math.min(.97,base));
    p.controlSuccess=Math.random()<successChance;
    p.controlQuality=p.controlSuccess
      ? (.91+Math.random()*.09)
      : (.58+Math.random()*.20);
    p.controlMistakeSide=Math.random()<.5?-1:1;
    if(!p.controlSuccess && mode==="stopcon"){
      p.controlUntil+=85+Math.random()*70;
    }

    if(reactive && p.controlSuccess && (mode==="backcon" || mode==="stopcon")){
      addAutoHighlight(mode==="backcon"?"BACKCON":"STOPCON",
        `${p.name} · ${mode==="backcon"?"빽컨 회피":"스탑컨 세이브"}`,now,p.index,1);
    }

    if(p.match){
      p.match.controlAttempts=(p.match.controlAttempts||0)+1;
      if(p.controlSuccess) p.match.controlSuccesses=(p.match.controlSuccesses||0)+1;
      const c=p.match.controlByType&&p.match.controlByType[mode];
      if(c){
        c.attempts++;
        if(p.controlSuccess) c.successes++;
      }
    }
  }

  function chooseControl(p, now, dt){
    p.controlCooldown -= dt;
    p.reactiveControlCooldown -= dt;

    if(p.controlMode!=="normal" && now>=p.controlUntil){
      p.controlMode="normal";p.reactiveControl=false;p.reactiveThreatId=-1;
      p.controlQuality=1;p.controlMistakeSide=0;
    }

    const si=Math.min(p.seg,segs.length-1),s=segs[si];
    let immediate=null,immediateAlong=999,nearAhead=null,nearAlong=999;
    const earlySurvival=currentProgress(p)<routeLength*.56;
    const closeObs=playerPerceivedObservers(p,earlySurvival?7.70:6.8);

    // Absolutely no stop/back/zigzag/wide control or artificial slowing on clear road.
    if(!closeObs.length){
      // v2.54: on a clear road, never keep braking/reversing from an old threat.
      // The racer immediately returns to the fastest straight/inside line.
      // v4.191: absolutely no trick-control on empty road. Cancel every reactive
      // control immediately, including zigzag / diagonal / 360 / Marseille.
      p.controlMode="normal";p.controlUntil=0;p.reactiveControl=false;
      p.reactiveThreatId=-1;p.controlQuality=1;p.controlMistakeSide=0;
      p.backconStyle="none";p.marseilleUntil=0;
      return;
    }

    for(let i=0;i<closeObs.length;i++){
      const o=closeObs[i],dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;if(along<=0)continue;
      const lat=Math.abs(dx*s.nx+dy*s.ny);
      if(along<(earlySurvival?3.60:3.15)&&lat<(earlySurvival?2.58:2.25)&&along<immediateAlong){immediate=o;immediateAlong=along;}
      if(along<(earlySurvival?5.55:4.8)&&lat<(earlySurvival?4.20:3.8)&&along<nearAlong){nearAhead=o;nearAlong=along;}
    }

    if(p.controlMode==="normal"&&p.reactiveControlCooldown<=0){
      const reaction=(p.stats.reaction-72)/27,control=(p.stats.control-72)/27;
      const prediction=(p.stats.prediction-72)/27,pressure=(p.stats.pressure-72)/27;

      if(immediate){
        // v2.62: choose control from geometry. If either side is visibly open,
        // prefer a diagonal escape. Backcon is reserved for a genuinely blocked front.
        let leftBlock=0,rightBlock=0;
        for(let ci=0;ci<closeObs.length;ci++){
          const o=closeObs[ci],dx=o.x-p.x,dy=o.y-p.y;
          const along=dx*s.ux+dy*s.uy,lat=dx*s.nx+dy*s.ny;
          if(along<=0||along>6.5) continue;
          if(lat<0&&Math.abs(lat)<5.2) leftBlock++;
          if(lat>=0&&Math.abs(lat)<5.2) rightBlock++;
        }
        const sideEscapeOpen=Math.min(leftBlock,rightBlock)===0;
        const controlPack=packAwareness(p,s);
        // v3.63: dense packs favor early corridor selection over abrupt last-second
        // tricks. These controls remain available, just less likely while overlapping.
        const packControlCalm=controlPack.mates>=3?.52:controlPack.mates>=2?.72:1;
        // v4.03: all reactive trick-control tendencies +20% around observers,
        // but the live leader protects position and uses them much less often.
        const leaderControlCalm=liveRaceSituation(p).rank===1?.12:1; // v4.57 leader pace: suppress showy controls
        // v3.51: only when an observer is immediately ahead, increase both
        // zigzag and backcon selection weights by 20% relative to v3.50.
        // v4.191: nearby danger uses a varied human control palette. Reverse is rare;
        // forward/diagonal movement is the default escape. No control is selected merely
        // because a far observer is visible.
        // v4.194: Marseille is disabled because the full-turn animation can look
        // like a collision pass-through. Natural diagonal escape is the main tool;
        // stop-control is more common, while reverse is a very rare last resort.
        const marseilleWeight=0;
        // v4.50 CONTROL DIVERSITY: keep the racer moving. Seeing an immediate observer
        // normally produces a forward diagonal escape; zigzag and 360 are visible alternatives.
        // Stop is nearly eliminated because repeated braking reads as stutter. Reverse stays rare.
        // v4.56 CONTROL DIVERSITY 2: pick the trick from the actual threat geometry.
        // Diagonal = default early escape. Zigzag = crossing/uncertain lanes. 360 = close
        // one-sided feint with room to curl. Back = almost impossible unless boxed point-blank.
        const mem=p.perceivedObservers&&p.perceivedObservers.get(immediate.id);
        const ovx=mem?.vx||0, ovy=mem?.vy||0;
        const obsForward=ovx*s.ux+ovy*s.uy, obsLateral=Math.abs(ovx*s.nx+ovy*s.ny);
        const crossing=obsLateral>Math.abs(obsForward)*.72 && obsLateral>.18;
        const oneSidePressure=Math.abs(leftBlock-rightBlock)>=1;
        const stopWeight=(!sideEscapeOpen && immediateAlong<.72 && leftBlock>0 && rightBlock>0 ? .000045 : 0)*leaderControlCalm; // v4.59.5 stop only when truly boxed point-blank
        const spinWeight=(oneSidePressure && sideEscapeOpen ? .082 : .030)*packControlCalm*leaderControlCalm;
        const diagonalWeight=(crossing?.98:1.30)*packControlCalm;
        const backWeight=((!sideEscapeOpen && immediateAlong<.92 && leftBlock>0 && rightBlock>0) ? .0065 : .00008)*leaderControlCalm;
        const zigWeight=(crossing?.245:.105)*leaderControlCalm;
        const totalWeight=marseilleWeight+stopWeight+spinWeight+diagonalWeight+backWeight+zigWeight;
        const r=Math.random()*totalWeight;
        let cut=marseilleWeight;
        if(r<cut){
          p.controlMode="marseille";
          p.reactiveControl=true;
          p.reactiveThreatId=immediate.id;
          p.modeStart=now;
          p.controlUntil=now+360+Math.random()*120;
          p.marseilleUntil=p.controlUntil;
          p.marseilleSide=(leftBlock<=rightBlock?-1:1);
          p.reactiveControlCooldown=850+Math.random()*760;
          p.match.controlAttempts++;
          p.match.controlSuccesses++;
          const mc=p.match.controlByType&&p.match.controlByType.marseille;if(mc){mc.attempts++;mc.successes++;}
          addAutoHighlight("MARSEILLE",`${p.name} · 마르세유턴 회피`,now,p.index,2);
        }else if(r<(cut+=stopWeight)){
          beginControl(p,"stopcon",now,55+Math.random()*55,true,immediate.id);
          p.reactiveControlCooldown=900+Math.random()*900;
        }else if(r<(cut+=spinWeight)){
          beginControl(p,"spin360",now,300+Math.random()*110,true,immediate.id);
          p.reactiveControlCooldown=800+Math.random()*750;
        }else if(r<(cut+=diagonalWeight)){
          beginControl(p,"diagonal",now,180+Math.random()*130,true,immediate.id);
          p.reactiveControlCooldown=620+Math.random()*650;
        }else if(r<(cut+=backWeight)){
          // Only a tiny reverse tap. Long back-controls are disabled in v4.191.
          beginControl(p,"backcon",now,95+Math.random()*50,true,immediate.id,"tap");
          p.reactiveControlCooldown=1400+Math.random()*1000;
        }else{
          beginControl(p,"zigzag",now,240+Math.random()*210,true,immediate.id);
          p.reactiveControlCooldown=620+Math.random()*700;
        }
        return;
      }

      if(nearAhead){
        const nearLeaderCalm=liveRaceSituation(p).rank===1?.10:1; // v4.57 leader pace
        const zigChance=Math.min(.62,(.38+reaction*.05+prediction*.05+pressure*.03)*nearLeaderCalm);
        if(Math.random()<zigChance){
          const rr=Math.random();
          const nearMem=p.perceivedObservers&&p.perceivedObservers.get(nearAhead.id);
          const nlat=Math.abs((nearMem?.vx||0)*s.nx+(nearMem?.vy||0)*s.ny);
          const nfwd=Math.abs((nearMem?.vx||0)*s.ux+(nearMem?.vy||0)*s.uy);
          const nearCross=nlat>nfwd*.72 && nlat>.18;
          const nearMode=rr<(nearCross?.735:.875)?"diagonal":rr<(nearCross?.955:.955)?"zigzag":"spin360"; // v4.59.5 no stop in normal near-threat palette
          const dur=nearMode==="diagonal"?170+Math.random()*120:nearMode==="zigzag"?230+Math.random()*180:nearMode==="spin360"?280+Math.random()*100:50+Math.random()*45;
          beginControl(p,nearMode,now,dur,true,nearAhead.id);
          p.reactiveControlCooldown=950+Math.random()*1200;return;
        }
      }
    }

    // Nearby observers exist but are not directly threatening: occasional moving
    // controls only. Never stop on this branch.
    if(nearAhead && p.controlMode==="normal"&&p.controlCooldown<=0){
      // v4.57 LEADER PACE: no decorative controls while leading; actual danger
      // is still handled by the immediate and predictive avoidance branches.
      if(liveRaceSituation(p).rank===1) return;
      const ag=(p.profile.aggression-60)/40,ct=(p.profile.control-85)/15;
      // v4.191: nearby-but-not-urgent threats stay forward-moving. No backcon here.
      const rr=Math.random();
      const farMem=p.perceivedObservers&&p.perceivedObservers.get(nearAhead.id);
      const flat=Math.abs((farMem?.vx||0)*s.nx+(farMem?.vy||0)*s.ny);
      const ffwd=Math.abs((farMem?.vx||0)*s.ux+(farMem?.vy||0)*s.uy);
      const farCross=flat>ffwd*.72 && flat>.18;
      const mode=rr<(farCross?.755:.885)?"diagonal":rr<(farCross?.965:.96)?"zigzag":"spin360"; // v4.59.5 moving controls only
      let duration=mode==="diagonal"?180+Math.random()*120:mode==="zigzag"?260+Math.random()*180:mode==="spin360"?290+Math.random()*100:55+Math.random()*45;
      duration*=(1.04-ct*.10);
      beginControl(p,mode,now,duration,true,nearAhead.id);
      p.controlCooldown=(4300-ag*650)+Math.random()*(4200-ag*400);
    }
  }

  function optimalOffsetFor(p){
    const si=Math.min(p.seg,segs.length-1);
    const cur=segs[si];
    const next=segs[Math.min(segs.length-1,si+1)];
    const half=widths[si]*0.72;

    if(!next) return 0;
    const turn=cur.ux*next.uy-cur.uy*next.ux;
    const lineSkill=(p.profile.line-85)/15; // ~0.2 to ~0.75
    if(Math.abs(turn)<0.035){
      return p.desiredOffset*(0.30-lineSkill*0.12);
    }
    // Better line skill clips the apex more precisely.
    const apex=0.82 + lineSkill*0.15;
    return (turn>0 ? 1 : -1)*half*apex;
  }

  function clampRoadOffset(si,lateral,p=null){
    // v4.10: normal AI stays on the route ribbon. During an explicit extreme-inside
    // attempt, air units may use the full survivable margin; failed attempts are allowed
    // to target just beyond it and are then killed by lethalOutsideRoad().
    let legalHalf=Math.max(2.0,widths[si]*ROAD_MARGIN);
    if(p && p.extremeInsideActive){
      legalHalf += DEATH_EDGE_EXTRA + (p.extremeInsideFail?1.25:-0.42);
    }
    return Math.max(-legalHalf*.998,Math.min(legalHalf*.998,lateral));
  }

  function nearestRouteFrame(x,y,aroundSeg=0){
    let best=null;
    const lo=Math.max(0,aroundSeg-2), hi=Math.min(segs.length-1,aroundSeg+2);
    for(let i=lo;i<=hi;i++){
      const s=segs[i], rx=x-s.a[0], ry=y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const qx=s.a[0]+s.ux*along, qy=s.a[1]+s.uy*along;
      const dx=x-qx,dy=y-qy,d2=dx*dx+dy*dy;
      if(!best||d2<best.d2) best={si:i,d2,lateral:rx*s.nx+ry*s.ny,along};
    }
    return best;
  }

  // v4.09 COURSE MODEL:
  // The route itself is the source of truth. We do NOT encode the user's red markup
  // as coordinate rectangles. Every route segment is treated as a rounded corridor
  // (capsule), so bends join naturally, all normal/inside lines are drivable, and the
  // large gaps between unrelated roads remain lethal. Yellow zones use safeAt().
  
  // v4.96 HARD RESTRICTED AREAS
  // These seven rectangles are the exact red boxes marked by the user on the full-map
  // screenshot, transformed into game coordinates. They are absolute no-entry zones.
  const FORBIDDEN96=[
    {x1:0.00,y1:0.80,x2:86.99,y2:11.72},
    {x1:0.18,y1:11.46,x2:10.22,y2:78.34},
    {x1:55.78,y1:35.17,x2:88.78,y2:45.83},
    {x1:76.94,y1:58.62,x2:88.60,y2:75.14},
    {x1:33.00,y1:109.25,x2:112.10,y2:121.78},
    {x1:148.86,y1:56.49,x2:165.36,y2:157.22},
    {x1:61.34,y1:156.95,x2:165.36,y2:170.54}
  ];
  const FORBIDDEN96_PAD=.18;

  function inForbidden96(x,y,pad=FORBIDDEN96_PAD){
    for(const z of FORBIDDEN96){
      if(x>=z.x1-pad && x<=z.x2+pad && y>=z.y1-pad && y<=z.y2+pad) return true;
    }
    return false;
  }

  function lineHitsForbidden96(x1,y1,x2,y2,pad=FORBIDDEN96_PAD){
    const dist=Math.hypot(x2-x1,y2-y1);
    const n=Math.max(2,Math.ceil(dist/.28));
    for(let k=0;k<=n;k++){
      const t=k/n;
      if(inForbidden96(x1+(x2-x1)*t,y1+(y2-y1)*t,pad)) return true;
    }
    return false;
  }

  function nearestForbiddenEscape96(x,y){
    let best=null,bestD=1e30;
    for(const z of FORBIDDEN96){
      const left=Math.abs(x-(z.x1-FORBIDDEN96_PAD-.55));
      const right=Math.abs(x-(z.x2+FORBIDDEN96_PAD+.55));
      const top=Math.abs(y-(z.y1-FORBIDDEN96_PAD-.55));
      const bottom=Math.abs(y-(z.y2+FORBIDDEN96_PAD+.55));
      const candidates=[
        {x:z.x1-FORBIDDEN96_PAD-.55,y},
        {x:z.x2+FORBIDDEN96_PAD+.55,y},
        {x,y:z.y1-FORBIDDEN96_PAD-.55},
        {x,y:z.y2+FORBIDDEN96_PAD+.55}
      ];
      const ds=[left,right,top,bottom];
      for(let i=0;i<4;i++){
        const c=candidates[i];
        if(c.x<1||c.x>MAP_W-1||c.y<1||c.y>MAP_H-1||inForbidden96(c.x,c.y)) continue;
        if(ds[i]<bestD){bestD=ds[i];best=c;}
      }
    }
    return best;
  }

function courseContainsPoint(x,y,extra=0){
    // v5.00: red zones are NOT physical/death geometry. They are only planning vetoes.
    if(safeAt(x,y)) return true;
    for(let i=0;i<segs.length;i++){
      const s=segs[i], rx=x-s.a[0], ry=y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const qx=s.a[0]+s.ux*along, qy=s.a[1]+s.uy*along;
      const r=Math.max(2.0,widths[i]*ROAD_MARGIN)+extra;
      const dx=x-qx,dy=y-qy;
      if(dx*dx+dy*dy<=r*r) return true;
    }
    return false;
  }

  function lineStaysOnCourse(x1,y1,x2,y2,extra=ROUTE_PLAN_EXTRA){
    // v4.96: no target/path chord may cross a red restricted area.
    if(lineHitsForbidden96(x1,y1,x2,y2)) return false;
    const dist=Math.hypot(x2-x1,y2-y1);
    const n=Math.max(2,Math.ceil(dist/.70));
    for(let k=1;k<=n;k++){
      const t=k/n;
      if(!courseContainsPoint(x1+(x2-x1)*t,y1+(y2-y1)*t,extra)) return false;
    }
    return true;
  }

  function courseAwareTarget(p,si,tx,ty){
    // Keep the optimized target if the entire chord is legal. Extreme-inside attempts
    // get the same route-derived margin used by death logic, but still cannot chord
    // across unrelated roads / red gaps.
    const planExtra=(p&&p.extremeInsideActive)
      ? DEATH_EDGE_EXTRA+(p.extremeInsideFail?1.15:-0.48)
      : ROUTE_PLAN_EXTRA;
    if(lineStaysOnCourse(p.x,p.y,tx,ty,planExtra)) return {x:tx,y:ty};
    const s=segs[si];
    const baseX=s.b[0]+s.nx*p.desiredOffset;
    const baseY=s.b[1]+s.ny*p.desiredOffset;
    for(const keep of [.72,.52,.34,.18,0]){
      const cx=baseX+(tx-baseX)*keep;
      const cy=baseY+(ty-baseY)*keep;
      if(lineStaysOnCourse(p.x,p.y,cx,cy,planExtra)) return {x:cx,y:cy};
    }
    return {x:baseX,y:baseY};
  }

  function segmentRangeContains69(x,y,lo,hi,extra){
    lo=Math.max(0,lo); hi=Math.min(segs.length-1,hi);
    for(let i=lo;i<=hi;i++){
      const s=segs[i],rx=x-s.a[0],ry=y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const qx=s.a[0]+s.ux*along,qy=s.a[1]+s.uy*along;
      const r=Math.max(2.0,widths[i]*ROAD_MARGIN)+extra;
      const dx=x-qx,dy=y-qy;
      if(dx*dx+dy*dy<=r*r) return true;
    }
    return false;
  }

  function lethalOutsideRoad(p,now){
    // Standard whole-map lethal corridor.
    if(courseContainsPoint(p.x,p.y,DEATH_EDGE_EXTRA)){
      p.outsideGrace69Since=0;
      return false;
    }

    // v4.69 11-O'CLOCK CORNER GRACE:
    // The climb from 9 o'clock through the upper-left kink (route segments ~20-26)
    // used to kill borderline legal-looking inside cuts because the rounded segment
    // capsules met too tightly. Give that LOCAL transition a small geometric cushion.
    // This does not open a global shortcut and does not change driving physics.
    const inUpperLeft=p.seg>=19 && p.seg<=27;
    if(inUpperLeft && segmentRangeContains69(p.x,p.y,20,26,DEATH_EDGE_EXTRA+2.05)){
      p.outsideGrace69Since=0;
      return false;
    }

    // One-frame / tiny steering overshoots near that same corner get a short grace.
    // A genuinely early cut remains outside the soft envelope and dies immediately;
    // lingering outside also dies after the brief tolerance expires.
    if(inUpperLeft && segmentRangeContains69(p.x,p.y,20,26,DEATH_EDGE_EXTRA+3.05)){
      if(!p.outsideGrace69Since) p.outsideGrace69Since=now||1;
      if((now||0)-p.outsideGrace69Since<=170) return false;
    }else{
      p.outsideGrace69Since=0;
    }
    return true;
  }


  function clampToRoad(p){
    // v4.03 AIR UNIT: intentionally no physical road boundary.
    // Never push, snap, slow, or teleport a racer for leaving the painted road.
    return;
  }


  function rescueIfStuck(p,now){
    const prog=currentProgress(p);

    // v4.03: no edge-wall anti-stall correction; air units have no wall to fight.
    if(prog > p.lastProgress + 0.18){
      p.lastProgress=prog;
      p.lastAdvanceAt=now;
      p.lastX=p.x; p.lastY=p.y;
      return;
    }

    if(!p.lastAdvanceAt) p.lastAdvanceAt=now;
    if(now-p.lastAdvanceAt < STUCK_RESCUE_MS) return;

    // v3.56: preserve the anti-stuck recovery but NEVER use desiredOffset
    // to relocate sideways. Advance only a small amount along the CURRENT
    // segment while preserving the racer's actual lateral position.
    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    let along=rx*s.ux+ry*s.uy;
    const actualLateral=rx*s.nx+ry*s.ny;
    along=Math.max(0,Math.min(s.L,along+0.72));
    const rescueX96=s.a[0]+s.ux*along+s.nx*actualLateral;
    const rescueY96=s.a[1]+s.uy*along+s.ny*actualLateral;
    p.x=rescueX96;
    p.y=rescueY96;
    p.controlMode="normal";
    p.controlUntil=0;
    p.avoidPlanUntil=0;
    p.lastProgress=currentProgress(p);
    p.lastAdvanceAt=now;
  }


  const OBS_GRID_SIZE = 16;
  const OBS_GRID_COLS = Math.ceil(MAP_W/OBS_GRID_SIZE);
  const OBS_GRID_ROWS = Math.ceil(MAP_H/OBS_GRID_SIZE);
  const observerGrid = Array.from({length:OBS_GRID_COLS*OBS_GRID_ROWS},()=>[]);

  function rebuildObserverGrid(){
    for(let i=0;i<observerGrid.length;i++) observerGrid[i].length=0;
    for(let i=0;i<observers.length;i++){
      const o=observers[i];
      let gx=Math.floor(o.x/OBS_GRID_SIZE);
      let gy=Math.floor(o.y/OBS_GRID_SIZE);
      if(gx<0) gx=0; else if(gx>=OBS_GRID_COLS) gx=OBS_GRID_COLS-1;
      if(gy<0) gy=0; else if(gy>=OBS_GRID_ROWS) gy=OBS_GRID_ROWS-1;
      observerGrid[gy*OBS_GRID_COLS+gx].push(o);
    }
  }

  const nearbyBufferPool = Array.from({length:12},()=>[]);
  const localPlayerBuffers = Array.from({length:12},()=>[]);
  const threatObserverBuffers = Array.from({length:12},()=>[]);
  const threatDistanceBuffers = Array.from({length:12},()=>[]);

  function nearestThreats(raw,p,limit=6){
    const obs=threatObserverBuffers[p.index];
    const ds=threatDistanceBuffers[p.index];
    obs.length=0; ds.length=0;
    for(let ri=0;ri<raw.length;ri++){
      const o=raw[ri];
      const dx=o.x-p.x, dy=o.y-p.y;
      const d=dx*dx+dy*dy;
      let pos=ds.length;
      if(pos<limit){
        ds.push(d); obs.push(o);
      }else if(d>=ds[pos-1]){
        continue;
      }else{
        pos=limit-1;
      }
      while(pos>0 && d<ds[pos-1]){
        if(pos<limit){ ds[pos]=ds[pos-1]; obs[pos]=obs[pos-1]; }
        pos--;
      }
      ds[pos]=d; obs[pos]=o;
      if(ds.length>limit){ ds.length=limit; obs.length=limit; }
    }
    return obs;
  }
  let nearbyBufferIndex=0;

  function nearbyObservers(x,y,r){
    const out=nearbyBufferPool[nearbyBufferIndex];
    nearbyBufferIndex=(nearbyBufferIndex+1)%nearbyBufferPool.length;
    out.length=0;
    const minX=Math.floor((x-r)/OBS_GRID_SIZE);
    const maxX=Math.floor((x+r)/OBS_GRID_SIZE);
    const minY=Math.floor((y-r)/OBS_GRID_SIZE);
    const maxY=Math.floor((y+r)/OBS_GRID_SIZE);
    for(let gx=minX;gx<=maxX;gx++){
      for(let gy=minY;gy<=maxY;gy++){
        if(gx<0||gy<0||gx>=OBS_GRID_COLS||gy>=OBS_GRID_ROWS) continue;
        const bucket=observerGrid[gy*OBS_GRID_COLS+gx];
        for(let i=0;i<bucket.length;i++) out.push(bucket[i]);
      }
    }
    return out;
  }

  // v4.23 HUMAN REACTION TIMING
  // Returns a small, player-specific delay instead of letting the AI react on the same frame.
  // Reaction/focus/pressure reduce delay; consistency reduces timing variance.
  function humanRecognitionDelayMs(p,urgency=0){
    const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const focusN=Math.max(0,Math.min(1,(p.stats.focus-72)/27));
    const pressureN=Math.max(0,Math.min(1,(p.stats.pressure-72)/27));
    const consistencyN=Math.max(0,Math.min(1,(p.stats.consistency-72)/27));
    const skill=reactionN*.55+focusN*.30+pressureN*.15;
    const base=156-skill*78-urgency*26;
    const spread=38-consistencyN*25;
    return Math.max(50,Math.min(184,base+(Math.random()-.5)*spread));
  }

  function humanCommandDelayMs(p,urgency=0){
    const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const focusN=Math.max(0,Math.min(1,(p.stats.focus-72)/27));
    const skill=reactionN*.52+controlN*.30+focusN*.18;
    const base=110-skill*55-urgency*20;
    return Math.max(28,Math.min(130,base+(Math.random()-.5)*24));
  }

  // v4.21 HUMAN PERCEPTION LAYER
  // AI planning is no longer allowed to consume the omniscient nearby-observer list.
  // A racer sees a forward cone plus a small close peripheral bubble, then keeps a
  // short imperfect memory. Physical collision still checks the real observer field.
  function playerPerceivedObservers(p,r,now=performance.now()){
    if(!p.perceivedObservers || !(p.perceivedObservers instanceof Map)) p.perceivedObservers=new Map();
    const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const focusN=Math.max(0,Math.min(1,(p.stats.focus-72)/27));
    const predictionN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const consistencyN=Math.max(0,Math.min(1,(p.stats.consistency-72)/27));
    const perceptionSkill=focusN*.42+reactionN*.25+predictionN*.25+consistencyN*.08;
    // v4.59.6 DYNAMIC VISION: racers look much farther down the road than sideways.
    // The larger forward read is still personal/stat-driven and uses perceived motion only.
    const visionScale=.98+focusN*.12+reactionN*.06;
    const maxR=Math.min(r,(p.visionRadius||r)*visionScale);
    const raw=playerNearbyObservers(p,maxR);
    let hx=p.steerX||0, hy=p.steerY||0;
    let hl=Math.hypot(hx,hy);
    if(hl<.15){ const seg=segs[Math.min(p.seg,segs.length-1)]; hx=seg.ux; hy=seg.uy; hl=1; }
    hx/=hl; hy/=hl;
    const halfFov=(78+focusN*10)*Math.PI/180; // v4.59.7 very wide forward combat vision // v4.59.6 wider forward awareness
    const cosFov=Math.cos(halfFov);
    const peripheral=4.20+reactionN*1.60;
    const memoryMs=350+predictionN*430+focusN*220;
    for(const o of raw){
      const dx=o.x-p.x,dy=o.y-p.y,d=Math.hypot(dx,dy);
      if(d<.001) continue;
      const dot=(dx*hx+dy*hy)/d;
      const visible=d<=peripheral || dot>=cosFov;
      if(visible){
        const prev=p.perceivedObservers.get(o.id);
        // v4.37: marginal/far sightings may need a second visual sample for lower-focus
        // racers. Close peripheral threats are never randomly hidden.
        const edgeN=Math.max(0,Math.min(1,(dot-cosFov)/Math.max(.001,1-cosFov)));
        const farN=Math.max(0,Math.min(1,d/Math.max(1,maxR)));
        const weakSight=d>peripheral+1.5 && (farN>.56 || edgeN<.24);
        const confirmNeed=weakSight ? (1+(perceptionSkill<.52?2:perceptionSkill<.76?1:0)) : 1;
        const seenCount=(prev?.seenCount||0)+1;
        // Never drop an already-confirmed track; uncertainty is in acquisition/estimate.
        if(!prev?.confirmed && seenCount<confirmNeed){
          p.perceivedObservers.set(o.id,{id:o.id,lastSeen:now,x:o.x,y:o.y,vx:0,vy:0,visible:true,
            awareAt:now+humanRecognitionDelayMs(p,0),seenCount,confirmed:false,errX:0,errY:0});
          continue;
        }
        let evx=0,evy=0;
        if(prev && now>prev.lastSeen+18){
          const dt=(now-prev.lastSeen)/1000;
          const rawVx=(o.x-prev.x)/dt, rawVy=(o.y-prev.y)/dt;
          const smooth=.54+predictionN*.29;
          evx=(prev.vx||0)*(1-smooth)+rawVx*smooth;
          evy=(prev.vy||0)*(1-smooth)+rawVy*smooth;
        }else if(prev){ evx=prev.vx||0; evy=prev.vy||0; }
        // Smooth, bounded visual estimate error. It shrinks as the observer gets closer
        // and as Focus/Prediction improve; no per-frame jitter and no fake collision.
        const errAmp=(.39-perceptionSkill*.31)*Math.max(.16,Math.min(1,d/18));
        const phase=(o.id*1.731+(p.perceptionTrackSeed||0));
        const targetErrX=(p.perceptionBiasX||0)*(.35+farN*.65)+Math.sin(phase)*errAmp;
        const targetErrY=(p.perceptionBiasY||0)*(.35+farN*.65)+Math.cos(phase*1.17)*errAmp;
        const errX=(prev?.errX||0)*.72+targetErrX*.28;
        const errY=(prev?.errY||0)*.72+targetErrY*.28;
        const urgency=Math.max(0,Math.min(1,(peripheral+2.8-d)/(peripheral+2.8)));
        const awareAt=prev?.confirmed ? (prev.awareAt||now) : (now+humanRecognitionDelayMs(p,urgency));
        p.perceivedObservers.set(o.id,{id:o.id,lastSeen:now,x:o.x,y:o.y,vx:evx,vy:evy,visible:true,
          awareAt,seenCount,confirmed:true,errX,errY});
      }
    }
    const out=[];
    for(const [id,m] of p.perceivedObservers){
      const age=now-m.lastSeen;
      if(age>memoryMs){ p.perceivedObservers.delete(id); continue; }
      if(!m.confirmed || now<(m.awareAt||0)) continue;
      if(m.awareAt){ p.lastRecognitionDelayMs=Math.max(0,m.awareAt-(m.lastSeen-age)); }
      const ageSec=age/1000;
      const fade=Math.max(0,1-age/memoryMs);
      const px=m.x+(m.errX||0)*fade+(m.vx||0)*ageSec*fade;
      const py=m.y+(m.errY||0)*fade+(m.vy||0)*ageSec*fade;
      const dx=px-p.x,dy=py-p.y;
      if(dx*dx+dy*dy<=r*r) out.push({
        id:m.id,x:px,y:py,vx:(m.vx||0)*fade,vy:(m.vy||0)*fade,
        phase:'move',phaseUntil:now+Math.max(120,memoryMs-age),speed:Math.hypot(m.vx||0,m.vy||0),
        perceived:true,confidence:fade*(.82+perceptionSkill*.18),lastSeenAge:age
      });
    }
    p.perceptionLastUpdate=now;
    return out;
  }

  // v2.7 performance: clustered racers share one broad observer-grid lookup.
  let playerNearbyFrameSerial=0;
  const playerNearbyFrameCache=Array.from({length:12},()=>({frame:-1,cellKey:"",broad:[],ranges:Object.create(null)}));
  let sharedNearbyFrame=-1;
  const sharedNearbyCells=new Map();

  function playerNearbyObservers(p,r){
    if(sharedNearbyFrame!==playerNearbyFrameSerial){
      sharedNearbyFrame=playerNearbyFrameSerial;
      sharedNearbyCells.clear();
    }
    const gx=Math.max(0,Math.min(OBS_GRID_COLS-1,Math.floor(p.x/OBS_GRID_SIZE)));
    const gy=Math.max(0,Math.min(OBS_GRID_ROWS-1,Math.floor(p.y/OBS_GRID_SIZE)));
    const cellKey=gx+":"+gy;
    let shared=sharedNearbyCells.get(cellKey);
    if(!shared){
      const cx=(gx+.5)*OBS_GRID_SIZE, cy=(gy+.5)*OBS_GRID_SIZE;
      const rr=AVOID_SCAN_RADIUS+OBS_GRID_SIZE*.76;
      const raw=nearbyObservers(cx,cy,rr);
      shared=[];
      for(let i=0;i<raw.length;i++) shared.push(raw[i]);
      sharedNearbyCells.set(cellKey,shared);
    }
    const cache=playerNearbyFrameCache[p.index];
    if(cache.frame!==playerNearbyFrameSerial || cache.cellKey!==cellKey){
      cache.frame=playerNearbyFrameSerial;
      cache.cellKey=cellKey;
      cache.broad.length=0;
      cache.ranges=Object.create(null);
      const broadR2=AVOID_SCAN_RADIUS*AVOID_SCAN_RADIUS;
      for(let i=0;i<shared.length;i++){
        const o=shared[i],dx=o.x-p.x,dy=o.y-p.y;
        if(dx*dx+dy*dy<=broadR2) cache.broad.push(o);
      }
    }
    if(r>=AVOID_SCAN_RADIUS-.001) return cache.broad;
    const key=String(r);
    let arr=cache.ranges[key];
    if(!arr) arr=cache.ranges[key]=[];
    arr.length=0;
    const r2=r*r;
    for(let i=0;i<cache.broad.length;i++){
      const o=cache.broad[i],dx=o.x-p.x,dy=o.y-p.y;
      if(dx*dx+dy*dy<=r2) arr.push(o);
    }
    return arr;
  }

  function escapeCorridorBias(p,s,nearby){
    // Look at several threats as one obstacle field instead of dodging only the
    // nearest observer. Positive/negative scores represent safer road sides.
    let leftRisk=0,rightRisk=0;
    const px=p.x+s.ux*p.speed*1.15;
    const py=p.y+s.uy*p.speed*1.15;
    for(let i=0;i<nearby.length;i++){
      const o=nearby[i];
      const dx=o.x-px, dy=o.y-py;
      const along=dx*s.ux+dy*s.uy;
      if(along<-3 || along>16) continue;
      const lat=dx*s.nx+dy*s.ny;
      const weight=Math.max(0,16-Math.abs(along));
      if(lat<0) leftRisk+=weight/(1+Math.abs(lat));
      else rightRisk+=weight/(1+Math.abs(lat));
    }
    return Math.max(-1,Math.min(1,(leftRisk-rightRisk)/8));
  }


  function observerClusterPlan(p,s,nearby){
    // v2.12: treat multiple nearby observers as a moving obstacle field.
    // We evaluate left / center / right corridors over several future horizons,
    // then commit briefly to the clearest escape corridor instead of reacting
    // to one observer at a time.
    const si=Math.min(p.seg,widths.length-1);
    const roadHalf=Math.max(2.2,widths[si]*0.56);
    const lateralNow=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const laneOffsets=[-roadHalf*.96,-roadHalf*.72,-roadHalf*.48,-roadHalf*.24,0,
      roadHalf*.24,roadHalf*.48,roadHalf*.72,roadHalf*.96];
    const laneRisk=laneOffsets.map(()=>0);
    const horizons=[.34,.72,1.18,1.82,2.65,3.35]; // v4.54: denser multi-observer future field
    let frontCount=0, closeCount=0, nearest=999;

    for(let hi=0;hi<horizons.length;hi++){
      const t=horizons[hi];
      const horizonWeight=hi===0?1.58:hi===1?1.22:hi===2?.96:hi===3?.76:.58; // v4.54
      const forward=p.speed*t;
      for(let li=0;li<laneOffsets.length;li++){
        const off=lateralNow+(laneOffsets[li]-lateralNow)*Math.min(1,t/.75);
        const px=p.x+s.ux*forward+s.nx*(off-lateralNow);
        const py=p.y+s.uy*forward+s.ny*(off-lateralNow);
        let risk=0;
        for(let oi=0;oi<nearby.length;oi++){
          const o=nearby[oi];
          const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
          const dx=ox-px, dy=oy-py;
          const d2=dx*dx+dy*dy;
          if(d2<81){
            const d=Math.sqrt(d2);
            risk += Math.max(0,9-d)*horizonWeight*(d<3.2?4.1:d<5.2?2.0:.72);
          }
        }
        // v4.54 MULTI-OBSERVER: a lane with several medium-close observers is more
        // dangerous than one equally-close observer. Add a pinch/congestion penalty so
        // AI does not escape observer A into the overlap of B/C.
        let pinch=0, nearLane=0;
        for(let oi=0;oi<nearby.length;oi++){
          const o=nearby[oi];
          const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
          const d=Math.hypot(ox-px,oy-py);
          if(d<6.2){ nearLane++; pinch+=Math.max(0,6.2-d); }
        }
        if(nearLane>=2) risk += pinch*(nearLane-1)*.36*horizonWeight;
        laneRisk[li]+=risk;
      }
    }

    for(let oi=0;oi<nearby.length;oi++){
      const o=nearby[oi];
      const dx=o.x-p.x, dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=Math.abs(dx*s.nx+dy*s.ny);
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<nearest) nearest=d;
      if(along>0 && along<15 && lat<roadHalf*1.35) frontCount++;
      if(along>0 && along<7.5 && lat<roadHalf*.95) closeCount++;
    }

    // v2.62: reward genuine openings between clusters, not just left/right escape.
    // This allows center gaps as well as outer corridors when 3–6 observers bunch up.
    if(frontCount>=3){
      for(let li=0;li<laneOffsets.length;li++){
        let nearestLatGap=99;
        for(let oi=0;oi<nearby.length;oi++){
          const o=nearby[oi],dx=o.x-p.x,dy=o.y-p.y;
          const along=dx*s.ux+dy*s.uy;
          if(along<=0||along>12) continue;
          const lat=dx*s.nx+dy*s.ny;
          nearestLatGap=Math.min(nearestLatGap,Math.abs(lat-laneOffsets[li]));
        }
        if(nearestLatGap>1.55) laneRisk[li]-=Math.min(10,(nearestLatGap-1.55)*2.4);
      }
    }

    let bestLane=0;
    for(let li=1;li<laneRisk.length;li++) if(laneRisk[li]<laneRisk[bestLane]) bestLane=li;
    const second=laneRisk.map((_,i)=>i).filter(i=>i!==bestLane).sort((a,b)=>laneRisk[a]-laneRisk[b])[0];
    const advantage=Math.max(0,laneRisk[second]-laneRisk[bestLane]);
    const density=Math.min(1,frontCount/5);
    const confidence=Math.min(1,advantage/12 + density*.42 + closeCount*.11);
    const preferredOffset=laneOffsets[bestLane];
    const emergency=closeCount>=2 || nearest<3.9;

    return {preferredOffset,confidence,density,emergency,frontCount,closeCount,laneRisk};
  }

  function cornerInsideSide(si){
    const i=Math.max(1,Math.min(route.length-2,si));
    const a=route[i-1], b=route[i], c=route[i+1];
    const v1x=b[0]-a[0], v1y=b[1]-a[1];
    const v2x=c[0]-b[0], v2y=c[1]-b[1];
    const cross=v1x*v2y-v1y*v2x;
    if(Math.abs(cross)<0.20) return 0;
    // Screen coordinates use +Y downward. That flips the handedness of the
    // ordinary Cartesian cross-product test. +off is still the racer's right
    // side (segment normal nx=-uy, ny=ux), so a screen-space negative cross is
    // a visual LEFT turn and its inside is -off; positive cross is a RIGHT
    // turn and its inside is +off. This generic rule fixes every corner without
    // hard-coded map coordinates.
    return cross<0 ? -1 : 1;
  }

  function cornerIntensity(si){
    const i=Math.max(1,Math.min(route.length-2,si));
    const a=route[i-1], b=route[i], c=route[i+1];
    const v1x=b[0]-a[0], v1y=b[1]-a[1];
    const v2x=c[0]-b[0], v2y=c[1]-b[1];
    const l1=Math.hypot(v1x,v1y)||1, l2=Math.hypot(v2x,v2y)||1;
    const dot=Math.max(-1,Math.min(1,(v1x*v2x+v1y*v2y)/(l1*l2)));
    return Math.acos(dot)/Math.PI;
  }



  function openingInsideBias(si){
    // Generic early-corner preparation, not a map-coordinate shortcut. Search
    // forward for the next meaningful turn and hug that turn's inside edge
    // progressively while still on the preceding straight. This makes long
    // approaches naturally form a smooth diagonal/arc instead of centre -> 90°.
    let foundSide=0, foundPower=0, distance=99;
    for(let k=0;k<7;k++){
      const idx=Math.min(route.length-2,si+k);
      const side=cornerInsideSide(idx);
      const power=cornerIntensity(idx);
      if(side!==0 && power>.035){ foundSide=side; foundPower=power; distance=k; break; }
    }
    if(!foundSide) return 0;
    const proximity=Math.max(0,1-distance/7);
    return foundSide*Math.min(.995,.58+proximity*.31+Math.min(.10,foundPower*.34));
  }

  function openingFastLineTarget(p,si){
    // v4.16 GENERIC START-STRAIGHT OPTIMIZER:
    // During the opening portion of the race, read the first meaningful upcoming
    // corner and move toward its inside edge immediately. This is based on route
    // topology/progress only — no map screenshot coordinates or hand-authored points.
    // It makes a long opening straight become a smooth diagonal toward the fastest
    // wall-side line instead of staying in the middle until the bend.
    const ratio=Math.max(0,Math.min(1,currentProgress(p)/Math.max(1,routeLength)));
    if(ratio>.22) return null;
    let side=0, power=0, cornerSeg=-1;
    for(let k=0;k<10;k++){
      const idx=Math.min(route.length-2,si+k);
      const cs=cornerInsideSide(idx);
      const cp=cornerIntensity(idx);
      if(cs!==0 && cp>.032){ side=cs; power=cp; cornerSeg=idx; break; }
    }
    if(!side) return null;

    // Only force the line while we are still on the approach to that first turn.
    // As the turn gets closer, commitment grows smoothly toward the legal edge.
    const segGap=Math.max(0,cornerSeg-si);
    const proximity=Math.max(0,1-Math.min(1,segGap/9));
    const insideSkill=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const readSkill=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlSkill=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*1.08);
    const commit=Math.min(.995,.91+insideSkill*.045+readSkill*.018+controlSkill*.012+proximity*.018+power*.025);
    // v4.194: stable per-racer opening bands. +1 = extreme inside, 0 = central-fast,
    // negative = lower/wider variant. This is a route choice, not random steering jitter.
    const identity=Math.max(-.72,Math.min(1,p.openingLineBias??.25));
    const strength=p.openingLineStrength||.9;
    // v4.62: personal opening identities now vary inside a fast corridor only.
    // Even the widest archetype stays on the correct side of the opening approach.
    const signedCommit=(.72 + identity*.12)*strength;
    return side*half*Math.max(.58,Math.min(.998,commit*signedCommit));
  }

  function futureInsideBias(si){
    let score=0, weight=0;
    for(let k=0;k<4;k++){
      const idx=Math.min(route.length-2,si+k);
      const side=cornerInsideSide(idx);
      const power=cornerIntensity(idx);
      if(side!==0 && power>0.025){
        const w=1/(1+k*0.55);
        score+=side*power*w;
        weight+=power*w;
      }
    }
    if(weight<0.01) return 0;
    return Math.max(-1,Math.min(1,score/weight));
  }

  function predictedObserverX(o,t){
    const vx=o.phase==="move"?(o.vx||0):0;
    const remain=o.phase==="move"?Math.max(0,((o.phaseUntil||observerPredictionNow)-observerPredictionNow)/1000):0;
    return Math.max(2.5,Math.min(MAP_W-2.5,o.x+vx*Math.min(t,remain||t)));
  }
  function predictedObserverY(o,t){
    const vy=o.phase==="move"?(o.vy||0):0;
    const remain=o.phase==="move"?Math.max(0,((o.phaseUntil||observerPredictionNow)-observerPredictionNow)/1000):0;
    return Math.max(2.5,Math.min(MAP_H-2.5,o.y+vy*Math.min(t,remain||t)));
  }

  const OBS_PRED_X=AVOID_HORIZONS.map(()=>new Float32Array(OBSERVER_COUNT));
  const OBS_PRED_Y=AVOID_HORIZONS.map(()=>new Float32Array(OBSERVER_COUNT));
  let observerPredictionNow=0;

  function precomputeObserverPredictions(now=performance.now()){
    observerPredictionNow=now;
    for(let hi=0;hi<AVOID_HORIZONS.length;hi++){
      const t=AVOID_HORIZONS[hi];
      const px=OBS_PRED_X[hi],py=OBS_PRED_Y[hi];
      for(let i=0;i<observers.length;i++){
        const o=observers[i];
        let moveT=0;
        if(o.phase==="move"){
          const remain=Math.max(0,((o.phaseUntil||now)-now)/1000);
          moveT=Math.min(t,remain);
        }
        const vx=o.phase==="move"?(o.vx||0):0;
        const vy=o.phase==="move"?(o.vy||0):0;
        let x=o.x+vx*moveT,y=o.y+vy*moveT;
        if(x<2.5)x=2.5;else if(x>MAP_W-2.5)x=MAP_W-2.5;
        if(y<2.5)y=2.5;else if(y>MAP_H-2.5)y=MAP_H-2.5;
        px[o.id]=x;py[o.id]=y;
      }
    }
  }

  function candidateAvoidanceRisk(p,s,targetOff,speedMul,nearby){
    const horizons=AVOID_HORIZONS;
    const lateralNow=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    let minClearSq=1e9;
    let danger=0;

    for(let hi=0;hi<horizons.length;hi++){
      const t=horizons[hi];
      const blend=Math.min(1,t/0.72);
      const off=lateralNow+(targetOff-lateralNow)*blend;
      const forward=p.speed*speedMul*t;
      const px=p.x+s.ux*forward+s.nx*(off-lateralNow);
      const py=p.y+s.uy*forward+s.ny*(off-lateralNow);
      const predX=OBS_PRED_X[hi], predY=OBS_PRED_Y[hi];

      for(let oi=0;oi<nearby.length;oi++){
        const o=nearby[oi];
        const dx=px-predX[o.id], dy=py-predY[o.id];
        const d2=dx*dx+dy*dy;
        if(d2<minClearSq) minClearSq=d2;

        // v2.53: moving observers get extra safety margin. A stopped observer is
        // predictable, so the racer is allowed to cut slightly closer to it.
        const phaseRemain=Math.max(0,((o.phaseUntil||observerPredictionNow)-observerPredictionNow)/1000);
        const motionRisk=o.phase==="move"
          ? (phaseRemain<.70 ? .94 : 1.18)
          : (phaseRemain<.38 ? 1.34 : .82);
        if(d2<4.0) danger += (4.0-d2)*118*motionRisk;
        else if(d2<16.0) danger += (16.0-d2)*12.4*motionRisk;
        else if(d2<49.0) danger += (49.0-d2)*0.80*motionRisk;
        else if(d2<100.0) danger += (100.0-d2)*0.065*motionRisk;
      }
    }

    const situationRisk=Math.max(0,Math.min(.48,p.tacticalRisk||0));
    const id=identityOf(p), safetyBias=id.safety||1;
    const survival=p.survivalNorm||0;
    // Better survival stats value clearance more strongly. The price is that
    // detours are penalized less, so these racers willingly travel farther.
    const progressRatio=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    // v4.51 EARLY SURVIVAL AI: strengthen only the pre-shelter decision window.
    // No invulnerability/speed rubber-band: racers simply recognize dangerous approach
    // a little earlier and prefer a slightly larger predicted clearance before shelter 1.
    const preShelterSafety=progressRatio<.56 ? 1.12 : (progressRatio<.64 ? 1.045 : 1);
    const survivalSafety=(1.36+survival*.84)*identityOf(p).safety*preShelterSafety; // v4.59.3: keep reliable clearance slightly ahead of raw lap distance
    const timeLoss=(1-speedMul)*(19.0+situationRisk*7.0)/Math.max(.90,safetyBias);
    const detour=Math.abs(targetOff-p.desiredOffset)*0.165*(2-safetyBias)*(1-survival*.70); // v4.59.3: safe detours remain cheap, but pointless wandering costs a little more
    return {score:danger*safetyBias*survivalSafety+timeLoss+detour,minClear:Math.sqrt(minClearSq)};
  }

  function observerGapPassPlan(p,s,nearby){
    // v2.60: detect a usable moving gap between two observers ahead.
    // Skilled/confident racers may thread the middle instead of taking a large detour.
    if(!nearby || nearby.length<2) return null;
    const skill=Math.max(0,Math.min(1,
      (((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4)-72)/27));
    const confidence=Math.max(0,Math.min(1,p.cleanConfidence||0));
    const minGap=1.52 - skill*.20 - confidence*.08; // still comfortably above 2*0.34 hit radius
    let best=null;
    for(let i=0;i<nearby.length;i++){
      const a=nearby[i];
      const adx=a.x-p.x, ady=a.y-p.y;
      const aa=adx*s.ux+ady*s.uy, al=adx*s.nx+ady*s.ny;
      if(aa<2.0 || aa>12.5) continue;
      for(let j=i+1;j<nearby.length;j++){
        const b=nearby[j];
        const bdx=b.x-p.x, bdy=b.y-p.y;
        const ba=bdx*s.ux+bdy*s.uy, bl=bdx*s.nx+bdy*s.ny;
        if(ba<2.0 || ba>12.5 || Math.abs(aa-ba)>4.2) continue;
        const gap=Math.abs(al-bl);
        if(gap<minGap || gap>7.8) continue;
        const mid=(al+bl)*.5;
        const centerCost=Math.abs(mid-p.desiredOffset);
        const score=centerCost + Math.abs(aa-ba)*.22 - gap*.18;
        if(!best || score<best.score) best={targetOff:mid,gap,score};
      }
    }
    if(!best) return null;
    const takeChance=Math.min(.93,.52+skill*.25+confidence*.16);
    if(Math.random()>takeChance) return null;
    return {targetOff:best.targetOff,speedMul:.995,gap:best.gap};
  }

  function escapeGatePlan(p,s,nearby){
    if(!nearby||nearby.length<2) return null;
    const half=Math.max(2.3,widths[Math.min(p.seg,widths.length-1)]*.58);
    const lanes=[-.92,-.62,-.32,0,.32,.62,.92];
    let best=null;
    for(const frac of lanes){
      const off=frac*half;
      let score=0,minClear=99,frontCount=0;
      for(const o of nearby){
        const dx=o.x-p.x,dy=o.y-p.y;
        const along=dx*s.ux+dy*s.uy;
        if(along<-.5||along>13.5) continue;
        const lat=dx*s.nx+dy*s.ny;
        const clear=Math.abs(lat-off);
        minClear=Math.min(minClear,clear);
        if(along>0&&along<9.5&&clear<2.4) frontCount++;
        score+=Math.max(0,3.5-clear)*(along>0&&along<9.5?3.2:1.0);
      }
      score+=Math.abs(off-p.desiredOffset)*.14;
      if(!best||score<best.score) best={targetOff:off,score,minClear,frontCount};
    }
    if(!best||best.frontCount>2||best.minClear<.72) return null;
    return {targetOff:best.targetOff,speedMul:.985,minClear:best.minClear,score:best.score};
  }

  function naturalSurvivalWeave(p,s,now,nearby){
    if(!nearby?.length) return null;
    const si=Math.min(p.seg,segs.length-1);
    const roadHalf=Math.max(3.4,widths[si]*.64);
    let front=0,leftRisk=0,rightRisk=0,centerRisk=0,nearest=999;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy,lat=dx*s.nx+dy*s.ny;
      if(along<-.6||along>17.5) continue;
      const d=Math.hypot(dx,dy); nearest=Math.min(nearest,d);
      const w=Math.max(.15,1-along/18)*Math.max(.18,1-Math.abs(lat)/(roadHalf+5));
      front+=w;
      if(lat<-.3) leftRisk+=w; else if(lat>.3) rightRisk+=w; else centerRisk+=w*1.35;
    }
    if(front<.52) return null;
    const skill=Math.max(0,Math.min(1,((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4-72)/27));
    const trigger=Math.min(.92,.62+skill*.20+Math.min(.06,front*.012));
    if(Math.random()>trigger && nearest>10.8) return null;
    const side=leftRisk<rightRisk?-1:rightRisk<leftRisk?1:(p.avoidLastSide|| (Math.random()<.5?-1:1));
    const pressure=Math.min(1,front*.40+centerRisk*.26+(nearest<8.5?.28:0));
    const target=side*roadHalf*(.48+pressure*.30);
    return {targetOff:target,speedMul:nearest<5.0?.96:.994,
      until:now+480+skill*250+Math.min(180,front*35),nearest,front};
  }

  function packAwareness(p,s){
    // v3.63: racers are non-solid, but overlapping racers share danger information.
    // A dense pack should see an observer field earlier rather than blindly copying
    // the same optimal line into the same obstacle.
    let mates=0, frontMates=0, lateralSum=0;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p||q.done) continue;
      const dx=q.x-p.x,dy=q.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=dx*s.nx+dy*s.ny;
      if(Math.abs(along)<7.8 && Math.abs(lat)<5.8){
        mates++;
        lateralSum+=lat;
        if(along>0&&along<6.8) frontMates++;
      }
    }
    const density=Math.min(1,mates/4);
    return {mates,frontMates,density,lateralMean:mates?lateralSum/mates:0};
  }

  function sharedPackDanger(p,s,baseNearby,pack){
    if(pack.mates<2) return baseNearby;
    const merged=baseNearby.slice();
    const seen=new Set(merged.map(o=>o.id));
    // Read the observer field around nearby racers too. This is perception sharing
    // only: player bodies never become obstacles and never affect collision physics.
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p||q.done) continue;
      const dx=q.x-p.x,dy=q.y-p.y;
      const along=dx*s.ux+dy*s.uy,lat=Math.abs(dx*s.nx+dy*s.ny);
      if(along<-2.5||along>8.5||lat>6.5) continue;
      const seenByQ=playerNearbyObservers(q,Math.min(21,p.visionRadius||21));
      for(let k=0;k<seenByQ.length;k++){
        const o=seenByQ[k];
        if(seen.has(o.id)) continue;
        const ox=o.x-p.x,oy=o.y-p.y;
        const oa=ox*s.ux+oy*s.uy,ol=Math.abs(ox*s.nx+oy*s.ny);
        if(oa>-4&&oa<22&&ol<10.5){merged.push(o);seen.add(o.id);}
      }
    }
    return merged;
  }

  function rolloutActionRisk(p,s,targetOff,speedMul,nearby){
    // v4.11 MICRO-ROLLOUT AI: instead of rating only fixed future snapshots,
    // actually simulate a short candidate action sequence. Better prediction/control
    // evaluates farther and more densely, so elite racers can survive OBS100 without
    // shrinking the real hit radius.
    const predN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const avoidN=Math.max(0,Math.min(1,(p.stats.avoidance-72)/27));
    const reactN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const skill=(predN+avoidN+reactN+controlN)/4;
    const horizon=2.20+predN*1.42+avoidN*.72;
    const steps=12+Math.round(predN*9+controlN*4+reactN*3);
    const dt=horizon/steps;
    let x=p.x,y=p.y;
    let lateral=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    let vx=s.ux*p.speed*speedMul, vy=s.uy*p.speed*speedMul;
    let danger=0,minClear=99;
    const hit=PLAYER_HIT_RADIUS;
    for(let k=1;k<=steps;k++){
      const t=k*dt;
      // steering cannot teleport laterally: approach the selected lane progressively.
      const steerRate=(.41+controlN*.38+reactN*.24);
      lateral += (targetOff-lateral)*Math.min(1,steerRate*dt*2.2);
      x += vx*dt + s.nx*(targetOff-lateral)*dt*.38;
      y += vy*dt + s.ny*(targetOff-lateral)*dt*.38;
      let stepThreats=0, stepPressure=0;
      for(const o of nearby){
        const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
        const d=Math.hypot(x-ox,y-oy);
        if(d<minClear) minClear=d;
        const clearance=d-hit;
        if(d<4.4){ stepThreats++; stepPressure+=Math.max(0,4.4-d); }
        if(clearance<0) danger += 26000+(Math.abs(clearance)+.05)*12000;
        else if(clearance<.62) danger += (0.62-clearance)*1900;
        else if(clearance<1.45) danger += (1.45-clearance)*220;
        else if(clearance<2.8) danger += (2.8-clearance)*16;
      }
      // v4.54: overlapping threats compound risk instead of being treated independently.
      if(stepThreats>=2) danger += stepPressure*(stepThreats-1)*(46+avoidN*28+predN*24);
    }
    // reward forward pace; elite racers accept narrower safe windows but never ignore a collision.
    const paceReward=speedMul*(5.8+skill*2.7);
    const steerCost=Math.abs(targetOff-p.desiredOffset)*(.10+(1-controlN)*.08);
    return {score:danger+steerCost-paceReward,minClear};
  }


  // v4.53 ESCAPE DIRECTION JUDGMENT: score the whole future corridor on each side,
  // not just the nearest observer. This makes left/right/diagonal choices prefer the
  // lane with the widest sustained survival window and reduces wrong-way dodges.
  function scoreEscapeCorridor(p,s,off,speedMul,nearby){
    const predN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const avoidN=Math.max(0,Math.min(1,(p.stats.avoidance-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const horizon=3.10+predN*.88; // v4.59.4: look farther down-road before committing to the nominal fastest line
    const steps=15+Math.round(predN*4);
    const startOff=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    let minClear=99,risk=0,closingRisk=0,coursePenalty=0,pinchRisk=0;
    for(let k=1;k<=steps;k++){
      const t=horizon*k/steps;
      const blend=1-Math.exp(-t*(2.0+controlN*.55));
      const simOff=startOff+(off-startOff)*blend;
      const forward=Math.max(.35,speedMul)*p.speed*t;
      const x=p.x+s.ux*forward+s.nx*(simOff-startOff);
      const y=p.y+s.uy*forward+s.ny*(simOff-startOff);
      if(!courseContainsPoint(x,y,ROUTE_PLAN_EXTRA*.74)) coursePenalty+=5.2;
      let nearCount=0, nearPressure=0;
      for(const o of nearby){
        const ox=predictedObserverX(o,t), oy=predictedObserverY(o,t);
        const d=Math.hypot(x-ox,y-oy);
        minClear=Math.min(minClear,d);
        const safe=2.62+avoidN*.42+predN*.31;
        if(d<5.2){ nearCount++; nearPressure+=Math.max(0,5.2-d); }
        if(d<safe){
          const q=(safe-d)/safe;
          risk += q*q*(3.8+(1-t/horizon)*4.8);
        }
        // Penalize observers whose inferred motion is converging into this corridor.
        const nowD=Math.hypot(p.x-o.x,p.y-o.y);
        if(d+0.35<nowD && d<5.8) closingRisk += (5.8-d)*(.12+(1-t/horizon)*.10);
      }
      // v4.54: avoid future choke points where two or more observers arrive together.
      if(nearCount>=2) pinchRisk += nearPressure*(nearCount-1)*(.20+(1-t/horizon)*.16);
    }
    // Prefer a sustained safety buffer. Small detours are cheap when they buy real space.
    const targetClear=3.08+avoidN*.44+predN*.36; // v4.59.4 slightly wider sustained margin
    const clearPenalty=minClear<targetClear?(targetClear-minClear)*(4.8+avoidN*2.2):0;
    const detour=Math.abs(off-p.desiredOffset)*(.017+(1-controlN)*.014); // v4.59.4 survival buys a little more route distance
    return {score:risk+closingRisk+pinchRisk+coursePenalty+clearPenalty+detour,minClear,coursePenalty,pinchRisk};
  }

  function scoreFutureEscapePath(p,s,off,speedMul,nearby){
    // v4.32 ESCAPE DIRECTION AI: compare each lateral escape over the next ~1.9 s.
    // The chosen side must stay on the legal course and remain clear of the whole
    // perceived observer field, not merely look empty at the current frame.
    const horizon=1.90;
    const steps=10;
    const baseOff=Number.isFinite(p.desiredOffset)?p.desiredOffset:0;
    let risk=0,minClear=99,coursePenalty=0,progress=0;
    let prevX=p.x,prevY=p.y;
    for(let k=1;k<=steps;k++){
      const t=horizon*k/steps;
      const blend=1-Math.exp(-t*2.45);
      const simOff=baseOff+(off-baseOff)*blend;
      const forward=Math.max(.25,speedMul)*p.speed*t;
      const x=p.x+s.ux*forward+s.nx*simOff;
      const y=p.y+s.uy*forward+s.ny*simOff;
      if(!courseContainsPoint(x,y,ROUTE_PLAN_EXTRA*.72)) coursePenalty+=4.8;
      if(!lineStaysOnCourse(prevX,prevY,x,y,ROUTE_PLAN_EXTRA*.76)) coursePenalty+=3.4;
      prevX=x;prevY=y;progress=forward;
      for(const o of nearby){
        const ox=predictedObserverX(o,t),oy=predictedObserverY(o,t);
        const d=Math.hypot(x-ox,y-oy);
        minClear=Math.min(minClear,d);
        const safe=2.05+(o.confidence==null?0:(1-o.confidence)*.18);
        if(d<safe){
          const q=(safe-d)/safe;
          // Later collisions still matter, but imminent collisions dominate.
          risk += q*q*(2.2+(1-t/horizon)*2.8);
        }
      }
    }
    // Avoid needlessly huge detours when two candidates are similarly safe.
    const detour=Math.abs(off-baseOff)*.055;
    return {score:risk+coursePenalty+detour-progress*.012,minClear,coursePenalty};
  }

  function boxedEscapePlan(p,s,nearby,raceOff){
    // v4.34 BLOCKED / SURROUND ESCAPE AI
    // When front + both sides are occupied, search the whole legal road ribbon for
    // a moving breakout corridor. Wide forward arcs are preferred; stop/back remain
    // emergency-only fallbacks. The plan looks farther than the normal dodge so the
    // racer escapes the cluster instead of bouncing inside it.
    const si=Math.min(p.seg,widths.length-1);
    const half=Math.max(3.3,widths[si]*.72);
    // v4.55 ENCIRCLEMENT BREAKOUT: when boxed, search farther toward the legal
    // road edges and prefer a corridor that stays open well beyond the first dodge.
    const base=Number.isFinite(raceOff)?raceOff:(Number.isFinite(p.desiredOffset)?p.desiredOffset:0);
    const candidates=[];
    for(const f of [-1.04,-.92,-.78,-.62,-.44,-.24,-.10,.10,.24,.44,.62,.78,.92,1.04]){
      candidates.push({off:clampRoadOffset(si,f*half,p),spd:f*f>.55?.97:1.01,kind:'breakout'});
    }
    // Keep a near-current option so a real center opening can win.
    candidates.push({off:clampRoadOffset(si,base,p),spd:.99,kind:'thread'});
    let best=null;
    for(const c of candidates){
      const r=scoreFutureEscapePath(p,s,c.off,c.spd,nearby);
      const short=rolloutActionRisk(p,s,c.off,c.spd,nearby);
      const ex=p.x+s.ux*9.8+s.nx*c.off, ey=p.y+s.uy*9.8+s.ny*c.off;
      // Long gate: surviving the first observer is not enough. Check that the same
      // corridor remains usable farther ahead so the racer actually exits the box.
      const lx=p.x+s.ux*14.2+s.nx*c.off, ly=p.y+s.uy*14.2+s.ny*c.off;
      let longClear=99, longPressure=0;
      for(const o of nearby){
        const ox=predictedObserverX(o,1.85), oy=predictedObserverY(o,1.85);
        const d=Math.hypot(lx-ox,ly-oy);
        longClear=Math.min(longClear,d);
        if(d<7.2) longPressure+=Math.max(0,7.2-d);
      }
      let score=r.score*1.62+short.score*.64+longPressure*.82;
      if(r.minClear<1.48) score+=(1.48-r.minClear)*12.5;
      if(longClear<2.25) score+=(2.25-longClear)*8.5;
      if(!courseContainsPoint(ex,ey,ROUTE_PLAN_EXTRA*.70) || !lineStaysOnCourse(p.x,p.y,ex,ey,ROUTE_PLAN_EXTRA*.76)) score+=28;
      // In a box, paying some racing-line detour is fine, but prefer the smallest
      // safe detour when survival scores are similar.
      score += Math.abs(c.off-base)*.035;
      if(c.kind==='breakout') score-=.38;
      if(!best||score<best.score) best={...c,score,minClear:r.minClear};
    }
    if(!best) return null;
    best.side=Math.sign(best.off-base)||Math.sign(best.off)||1;
    return best;
  }

  function humanLiveEvadeController(p,s,now,raceOff){
    // v4.52 APPROACH PREDICTION AI: trajectory-first early evade on genuinely converging observers
    // Read an observer's current travel vector and begin a single broad, committed arc
    // before the paths intersect. This replaces last-second micro-jukes near the sprite.
    if(safeAt(p.x,p.y)) return null;
    const vision=Math.min(62,p.visionRadius||62); // v4.59.7 large observer-combat sight // v4.59.6 long forward sight: break route fixation before contact
    const raw=playerPerceivedObservers(p,vision);
    if(!raw.length){
      p.liveEvadeDanger=0;
      // v4.60 HARD ROUTE LOCK: do not snap straight back to the memorized racing line
      // the instant an observer leaves vision. Hold the last escape corridor for a short
      // verified-safe grace window, then release route authority.
      if(now<(p.hardRouteLockUntil||0) && Number.isFinite(p.lockedEscapeOffset)){
        p.liveEvadeAction='lock-hold';
        p.liveEvadeOffset=p.lockedEscapeOffset;
        p.liveEvadeSpeed=Math.max(.97,p.lockedEscapeSpeed||.995);
        p.liveEvadeUntil=Math.max(p.liveEvadeUntil||0,p.hardRouteLockUntil);
        return {off:p.lockedEscapeOffset,speedMul:p.liveEvadeSpeed,danger:.18,side:p.lockedEscapeSide||0,routeLock:true};
      }
      p.hardRouteLockUntil=0;
      p.lockedEscapeOffset=undefined;
      if(now>=p.liveEvadeUntil){ p.liveEvadeAction='none'; p.liveEvadeSpeed=1; }
      return null;
    }
    const nearby=nearestThreats(raw,p,22);
    // v4.39 SPARSE-FIELD GUARD: the most avoidable deaths were happening with only
    // one or two readable observers nearby. In a sparse field there is usually plenty
    // of road, so value clean clearance over clever late skims and commit earlier.
    const sparseField=nearby.length<=2;
    // v4.54 MULTI-OBSERVER SURVIVAL: evaluate the whole perceived field before
    // choosing a live dodge. This prevents escaping observer A into B/C.
    const clusterNow=observerClusterPlan(p,s,nearby);
    const react=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const pred=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const ctrl=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const avoid=Math.max(0,Math.min(1,(p.stats.avoidance-72)/27));
    const skill=(react+pred+ctrl+avoid)/4;
    // v4.57 LEADER PACE: weak watch-level threats do not make the leader weave.
    // Real converging danger still has full avoidance authority.
    const leaderNow=liveRaceSituation(p).rank===1;
    const half=Math.max(3.3,widths[Math.min(p.seg,widths.length-1)]*.72);

    // v4.59.6 ROUTE BREAK AI: seeing a relevant observer ahead interrupts the old
    // racing-line plan before the normal collision score becomes large. The racer
    // deliberately throws away the held route click and creates a fresh escape click.
    // This is not omniscience: only personally perceived observers can trigger it.
    let routeBreakObserver=null, routeBreakScore=0;
    for(const o of raw){
      const dx=o.x-p.x, dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=dx*s.nx+dy*s.ny;
      if(along<.15 || along>42.0) continue;
      const laneWindow=half+10.5+pred*3.0;
      if(Math.abs(lat)>laneWindow) continue;
      const forwardN=1-Math.min(1,along/44);
      const laneN=1-Math.min(1,Math.abs(lat)/Math.max(1,laneWindow));
      const conf=o.confidence==null?1:o.confidence;
      const score=(forwardN*.55+laneN*.45)*(.72+.28*conf);
      if(score>routeBreakScore){ routeBreakScore=score; routeBreakObserver=o; }
    }
    const visualRouteBreak=!!routeBreakObserver && routeBreakScore>.075;
    if(visualRouteBreak){
      const rid=routeBreakObserver.id;
      // v4.59.8 COMMITTED ESCAPE: visual contact may break the race line once,
      // but it must NOT keep cancelling a good escape every ~125ms. While a chosen
      // corridor is committed, hold that mouse command unless a true emergency appears.
      const committed=now<(p.committedEscapeUntil||0);
      // v4.60: visual contact is a hard state transition, not a weak bias. Route AI
      // is locked out until the escape corridor has remained safe for a grace window.
      p.hardRouteLockUntil=Math.max(p.hardRouteLockUntil||0,now+920+pred*210+avoid*180);
      if(!committed && (p.routeBreakThreat!==rid || now>(p.routeBreakRefreshAt||0))){
        p.routeBreakThreat=rid;
        p.routeBreakForceClick=true;
        p.routeBreakRefreshAt=now+360+(1-react)*70;
        p.routeBreakCombatUntil=now+1380+pred*320+avoid*240;
        p.mouseNextThink=Math.min(p.mouseNextThink||now,now+8);
        p.mouseCommandUntil=Math.min(p.mouseCommandUntil||now,now+8);
      }
    }

    // v4.34: detect a genuine moving box (front plus both lateral exits pressured).
    // If already committed to a breakout, keep it briefly unless the corridor becomes illegal.
    const currentOff=Number.isFinite(raceOff)?raceOff:p.desiredOffset;
    const clusterLeftRisk=(clusterNow.laneRisk?.[0]||0)+(clusterNow.laneRisk?.[1]||0)+(clusterNow.laneRisk?.[2]||0);
    const clusterRightRisk=(clusterNow.laneRisk?.[6]||0)+(clusterNow.laneRisk?.[7]||0)+(clusterNow.laneRisk?.[8]||0);
    // v4.43 SURROUNDED fix: break out before the box fully closes.
    const boxedNow=clusterNow.frontCount>=2 && (clusterNow.closeCount>=1 || clusterNow.density>.48) && clusterLeftRisk>2.12 && clusterRightRisk>2.12; // v4.55 earlier encirclement escape
    if(now<(p.breakoutUntil||0)){
      const bx=p.x+s.ux*7.5+s.nx*p.breakoutOffset, by=p.y+s.uy*7.5+s.ny*p.breakoutOffset;
      if(courseContainsPoint(bx,by,ROUTE_PLAN_EXTRA*.72) && lineStaysOnCourse(p.x,p.y,bx,by,ROUTE_PLAN_EXTRA*.78)){
        p.liveEvadeAction='breakout';
        return {off:p.breakoutOffset,speedMul:p.breakoutSpeed||.99,danger:Math.max(.55,p.liveEvadeDanger||0),side:p.breakoutSide||0};
      }
      p.breakoutUntil=0;
    }

    let danger=0,nearest=99,threatId=-1,bestT=99,leftRisk=0,rightRisk=0;
    // Predict only a short human-readable horizon. We use the observer's visible motion,
    // not hidden route knowledge. Higher prediction skill samples a little farther ahead.
    const horizon=2.30+pred*1.70; // v4.59.4: earlier forward-corridor read, still trajectory-gated
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy,lat=dx*s.nx+dy*s.ny;
      const d=Math.hypot(dx,dy); nearest=Math.min(nearest,d);
      if(along<-3.5 || along>30.5 || Math.abs(lat)>14.5) continue; // v4.59.1 lone-observer early read
      // v4.22 trajectory threat: estimate time of closest approach from observed motion.
      // This lets racers bend away early from a crossing path while ignoring observers
      // whose visible trajectory is moving away from them.
      const rvx=(o.vx||0)-s.ux*p.speed, rvy=(o.vy||0)-s.uy*p.speed;
      const rv2=rvx*rvx+rvy*rvy;
      if(rv2>.01){
        const tc=Math.max(0,Math.min(horizon,-(dx*rvx+dy*rvy)/rv2));
        const cx=dx+rvx*tc, cy=dy+rvy*tc;
        const cpa=Math.hypot(cx,cy);
        const corridor=(2.34+avoid*.76+pred*.42)*(sparseField?1.30:1.10); // v4.59.4 wider future-safe corridor
        if(tc>.08 && cpa<corridor){
          const conf=o.confidence==null?1:o.confidence;
          // v4.52: reward a stable closing read. An observer can be far away, but if
          // its perceived velocity is clearly converging with our future path, begin a
          // broad diagonal escape before it becomes a last-second sprite dodge.
          const closing=-(dx*rvx+dy*rvy)/Math.max(.001,d);
          const closingN=Math.max(0,Math.min(1,(closing-.35)/4.2));
          const earlyRead=1+closingN*(.22+pred*.22)*(.72+.28*conf);
          const w=(corridor-cpa)/corridor*(1.48-tc/horizon*.38)*(.55+.45*conf)*earlyRead;
          danger+=w*1.35;
          if(tc<bestT){bestT=tc;threatId=o.id;}
          const crossLat=cx*s.nx+cy*s.ny;
          if(crossLat<0) leftRisk+=w*1.25; else rightRisk+=w*1.25;
        }
      }
      const samples=7+Math.round(pred*6);
      for(let k=1;k<=samples;k++){
        const t=horizon*k/samples;
        const ox=predictedObserverX(o,t),oy=predictedObserverY(o,t);
        const px=p.x+s.ux*p.speed*t,py=p.y+s.uy*p.speed*t;
        const sep=Math.hypot(px-ox,py-oy);
        const warn=(2.72+avoid*.66+pred*.26)*(sparseField?1.27:1.08);
        if(sep<warn){
          const w=(warn-sep)/warn*(1.20-t/horizon*.34);
          danger+=w;
          if(t<bestT){bestT=t;threatId=o.id;}
          const olat=(ox-px)*s.nx+(oy-py)*s.ny;
          if(olat<0) leftRisk+=w; else rightRisk+=w;
        }
      }
    }
    // Fold multi-observer corridor pressure into the live decision. A strong
    // cluster opening may override the single most-threatening observer side.
    if(clusterNow.frontCount>=2){
      danger += clusterNow.confidence*(.34+clusterNow.density*.30);
      const clusterDelta=clusterNow.preferredOffset-(Number.isFinite(raceOff)?raceOff:p.desiredOffset);
      if(clusterDelta<-.15) rightRisk += clusterNow.confidence*(1.0+clusterNow.density);
      else if(clusterDelta>.15) leftRisk += clusterNow.confidence*(1.0+clusterNow.density);
    }
    // v4.59.6 visual contact itself can break route fixation. If trajectory math is
    // still uncertain, create a low watch-level threat and bias away from the seen lane
    // instead of continuing to click the memorized racing line.
    if(visualRouteBreak && routeBreakObserver){
      danger=Math.max(danger,.62+routeBreakScore*.55);
      const rdx=routeBreakObserver.x-p.x, rdy=routeBreakObserver.y-p.y;
      const rlat=rdx*s.nx+rdy*s.ny;
      const visualW=.10+routeBreakScore*.20;
      danger=Math.max(danger,visualW);
      if(rlat<0) leftRisk+=.34+routeBreakScore*.60; else rightRisk+=.34+routeBreakScore*.60;
      if(threatId<0){ threatId=routeBreakObserver.id; bestT=Math.min(bestT,3.35); }
    }
    p.liveEvadeDanger=danger;
    // v4.35 RISK LADDER: convert continuous threat into a stable human-readable
    // safety tier. The tier changes how far/wide/often the virtual mouse acts.
    // 0=safe, 1=watch, 2=danger, 3=emergency. Hysteresis prevents rapid tier flicker.
    // v4.59 DEATH AI FINAL: one unified risk ladder. Dense/boxed fields escalate earlier,
    // while a lone non-converging observer still does not trigger decorative movement.
    const fieldPressure=(clusterNow.frontCount>=2?clusterNow.confidence*(.22+clusterNow.density*.28):0)+(boxedNow?.32:0);
    const finalDanger=danger+fieldPressure;
    const rawTier = (nearest<2.35 || bestT<.38 || finalDanger>1.48 || boxedNow) ? 3
      : (bestT<1.12 || finalDanger>.68) ? 2
      : (bestT<2.72 || finalDanger>.21) ? 1 : 0;
    const prevTier=p.dangerTier||0;
    if(rawTier>prevTier){ p.dangerTier=rawTier; p.dangerTierUntil=now+260; }
    else if(rawTier<prevTier && now<(p.dangerTierUntil||0)) p.dangerTier=prevTier;
    else { p.dangerTier=rawTier; if(rawTier) p.dangerTierUntil=now+180; }
    // Start early only when trajectories are actually converging. Mere proximity alone
    // no longer causes frantic inputs, but a close observer still gets an emergency read.
    // v4.43 NO_EVADE/LATE_REACTION fix: a readable converging path should trigger a
    // committed dodge earlier, while non-converging nearby observers still do nothing.
    const basePredictive=(finalDanger>(sparseField?.040:.086) && bestT<(sparseField?4.75:4.18)) || visualRouteBreak; // v4.59.6 visible observer may break the old route before CPA is certain
    // v4.59: leader pace remains sacred for weak reads, but a genuine converging
    // multi-observer lane gets avoidance authority before it becomes an emergency.
    const predictive=basePredictive && (!leaderNow || visualRouteBreak || finalDanger>.090 || bestT<3.82 || clusterNow.frontCount>=2); // v4.59.6 leader also abandons a held line on relevant visual contact
    const emergency=nearest<(sparseField?3.65:3.05);
    if(!predictive && !emergency && now>=p.liveEvadeUntil) return null;

    // v4.59.8 COMMITTED ESCAPE AI: once a safe corridor has been chosen, execute it.
    // Do not oscillate between every newly perceived observer. Only a point-blank
    // collision/real box is allowed to break the commitment early.
    if(now<(p.committedEscapeUntil||0) && Number.isFinite(p.committedEscapeOffset)){
      const hardOverride=boxedNow || nearest<1.62 || bestT<.26 || finalDanger>1.82;
      const legalSeg=Math.min(p.seg,segs.length-1);
      const cx=p.x+s.ux*6.6+s.nx*p.committedEscapeOffset;
      const cy=p.y+s.uy*6.6+s.ny*p.committedEscapeOffset;
      const stillLegal=courseContainsPoint(cx,cy,ROUTE_PLAN_EXTRA*.70) && lineStaysOnCourse(p.x,p.y,cx,cy,ROUTE_PLAN_EXTRA*.76);
      if(stillLegal && !hardOverride){
        p.liveEvadeOffset=p.committedEscapeOffset;
        p.liveEvadeSide=p.committedEscapeSide||p.liveEvadeSide||0;
        p.liveEvadeSpeed=p.committedEscapeSpeed||.995;
        p.liveEvadeAction='commit';
        p.liveEvadeThreat=p.committedEscapeThreat??threatId;
        p.liveEvadeUntil=Math.max(p.liveEvadeUntil||0,p.committedEscapeUntil);
        p.liveEvadeNextThink=Math.max(p.liveEvadeNextThink||0,p.committedEscapeUntil-70);
        return {off:p.liveEvadeOffset,speedMul:p.liveEvadeSpeed,danger:p.liveEvadeDanger,side:p.liveEvadeSide};
      }
      if(!stillLegal || hardOverride) p.committedEscapeUntil=0;
    }

    // v4.38 ADAPTIVE RE-JUDGMENT: a committed human dodge is not blind. If the
    // tracked observer materially changes its perceived heading/speed, or the predicted
    // collision side flips, unlock one early re-think instead of stubbornly holding the
    // old click. Small estimate noise is ignored and revisions have a cooldown.
    if(threatId>=0){
      const tracked=nearby.find(o=>o.id===threatId);
      if(tracked){
        const tvx=tracked.vx||0, tvy=tracked.vy||0;
        const tsp=Math.hypot(tvx,tvy);
        const pvx=p.evadeRevisionVx||0, pvy=p.evadeRevisionVy||0;
        const psp=Math.hypot(pvx,pvy);
        let headingDelta=0;
        if(tsp>.15 && psp>.15){
          const dot=Math.max(-1,Math.min(1,(tvx*pvx+tvy*pvy)/(tsp*psp)));
          headingDelta=Math.acos(dot);
        }
        const speedDelta=Math.abs(tsp-psp);
        const sideNow=((tracked.x-p.x)*s.nx+(tracked.y-p.y)*s.ny)<0?-1:1;
        const sideFlip=p.liveEvadeThreat===threatId && p.liveEvadeSide && sideNow===p.liveEvadeSide;
        const meaningful=(headingDelta>.34 || speedDelta>1.65 || (sideFlip && bestT<1.35));
        if(p.evadeRevisionThreat===threatId && meaningful && now>(p.evadeRevisionCooldown||0) && now<p.liveEvadeUntil){
          // Better Prediction/Reaction revises sooner; still keep a human-sized delay.
          const reviseDelay=48+(1-pred)*54+(1-react)*38;
          p.liveEvadeNextThink=Math.min(p.liveEvadeNextThink,now+reviseDelay);
          p.liveEvadeUntil=Math.min(p.liveEvadeUntil,now+reviseDelay+45);
          p.evadeRevisionCooldown=now+260+(1-ctrl)*150;
        }
        if(p.evadeRevisionThreat!==threatId || now-(p.evadeRevisionAt||0)>150){
          p.evadeRevisionThreat=threatId;
          p.evadeRevisionVx=tvx; p.evadeRevisionVy=tvy; p.evadeRevisionAt=now;
        }
      }
    }

    if(now>=p.liveEvadeNextThink){
      // v4.34: when boxed, pick one whole-corridor breakout before considering
      // ordinary left/right dodges. Keep moving; do not default to stop-control.
      if(boxedNow){
        const bo=boxedEscapePlan(p,s,nearby,currentOff);
        if(bo){
          p.breakoutOffset=bo.off;
          p.breakoutSpeed=bo.spd;
          p.breakoutSide=bo.side;
          p.breakoutScore=bo.score;
          p.breakoutUntil=now+690+avoid*220+ctrl*145; // v4.55 longer committed exit from the cluster
          p.liveEvadeOffset=bo.off;
          p.liveEvadeSpeed=bo.spd;
          p.liveEvadeSide=bo.side;
          p.liveEvadeAction='breakout';
          p.liveEvadeThreat=threatId;
          p.liveEvadeUntil=p.breakoutUntil;
          p.liveEvadeNextThink=now+255+Math.random()*95;
          p.match.avoids++;
          return {off:bo.off,speedMul:bo.spd,danger:Math.max(danger,.72),side:bo.side};
        }
      }
      // Commit for a visibly smooth interval. Replanning is slower than v4.194 so the
      // unit draws one natural diagonal curve instead of several tiny left/right taps.
      const chainActive=now<(p.evadeChainUntil||0);
      // v4.57 EVADE CHAIN: re-read sooner during an ongoing dodge so a second
      // threat becomes a flowing follow-up move rather than a fresh panic input.
      p.liveEvadeNextThink=now+(chainActive?235:390)-react*55-ctrl*35+Math.random()*(chainActive?55:85);
      const current=Number.isFinite(raceOff)?raceOff:p.desiredOffset;
      const tier=p.dangerTier||0;
      // Watch = small flowing correction, Danger = decisive diagonal, Emergency = wider escape.
      const evadeWidth=visualRouteBreak ? (tier>=3?1.56:tier>=2?1.38:1.16) : (tier===3?1.30:tier===2?1.15:tier===1?1.03:.88); // v4.61 pace-aware escape: still decisive, but no needless maximum-width detours
      const openSide=leftRisk<=rightRisk?-1:1;
      const preferred=p.liveEvadeSide||openSide;
      // v4.24 HUMAN DODGE: choose one coherent human action, then commit to it.
      // Diagonal flow is the default; stop-control is deliberately common for crossing
      // trajectories; zigzag/360 are occasional feints; reverse exists only when a
      // collision is virtually immediate and both lateral exits are crowded.
      const bothSidesBusy=leftRisk>.48 && rightRisk>.48;
      // v4.41 FUNDAMENTALS SURVIVAL: with only 1-2 readable observers, use
      // boring, high-clearance movement. Do not throw away an easy dodge with a feint/stop.
      const candidates=sparseField ? [
        {off:current+openSide*half*(visualRouteBreak?1.14:.88)*evadeWidth,spd:1.005,side:openSide,kind:'diag'},
        {off:current+openSide*half*(visualRouteBreak?1.42:1.10)*evadeWidth,spd:.985,side:openSide,kind:'wide'},
        {off:current-openSide*half*(visualRouteBreak?.88:.60)*evadeWidth,spd:.995,side:-openSide,kind:'alt'}
      ] : [
        {off:current+openSide*half*.60*evadeWidth,spd:tier===3?.995:1.012,side:openSide,kind:'diag'},
        {off:current+openSide*half*.90*evadeWidth,spd:tier===3?.955:.982,side:openSide,kind:'wide'},
        {off:current-openSide*half*.34*evadeWidth,spd:1.00,side:-openSide,kind:'alt'},
        {off:current+openSide*half*.30,spd:.96,side:openSide,kind:'zig'},
        {off:current+openSide*half*.22,spd:.91,side:openSide,kind:'spin'}
      ];
      // v4.59.4: STOP is no longer part of the normal palette. Only a virtually
      // closed, imminent box may use one tiny stop tap; otherwise keep flowing.
      if(emergency && bestT<.22 && bothSidesBusy && clusterNow.closeCount>=2){
        candidates.push({off:current+openSide*half*.08,spd:.10,side:openSide,kind:'stop'});
      }
      if(emergency && bestT<.30 && bothSidesBusy){
        candidates.push({off:current+openSide*half*.16,spd:-.075,side:openSide,kind:'back'});
      }
      let best=null;
      for(const c of candidates){
        const off=clampRoadOffset(Math.min(p.seg,segs.length-1),c.off,p);
        const r=rolloutActionRisk(p,s,off,c.spd,nearby);
        const future=scoreFutureEscapePath(p,s,off,c.spd,nearby);
        const corridor=scoreEscapeCorridor(p,s,off,c.spd,nearby);
        // v4.53: combine immediate rollout + future path + sustained corridor safety.
        // A direction that looks empty for one instant but closes a moment later loses.
        let score=r.score + future.score*1.14 + corridor.score*1.52; // v4.59.4 sustained 3–4s corridor matters more than raw shortest-line pace
        // v4.59 DEATH AI FINAL: survival beats cleverness. Penalize candidates that
        // are only briefly safe but collapse across the next observer wave.
        const collapseClear=Math.min(r.minClear,future.minClear,corridor.minClear);
        if(collapseClear<1.42) score+=(1.42-collapseClear)*13.5;
        if(clusterNow.frontCount>=2 && corridor.minClear<1.90) score+=(1.90-corridor.minClear)*7.5;
        if(future.minClear<1.20) score += (1.20-future.minClear)*8.0;
        if(corridor.minClear<1.55) score += (1.55-corridor.minClear)*11.0;
        // v4.39: with just 1-2 observers, reject needless skim-lines. There is enough
        // free road to take a cleaner diagonal, so a low-clearance candidate pays heavily.
        if(sparseField){
          const sparseClear=3.48+avoid*.46+pred*.36; // v4.59.4: one observer still gets a generous, obvious pass
          if(future.minClear<sparseClear) score += (sparseClear-future.minClear)*12.5;
          if(r.minClear<sparseClear*.82) score += (sparseClear*.82-r.minClear)*10.0;
          if(c.kind==='diag') score-=.72;
          if(c.kind==='wide' && bestT<2.45) score-=.42;
          if(c.kind==='alt') score+=.80;
        }
        if(clusterNow.frontCount>=2){
          const clusterDist=Math.abs(off-clusterNow.preferredOffset);
          score += clusterDist*(.28+clusterNow.confidence*.78); // v4.54 stronger whole-field corridor guidance
          if(Math.sign(off-current)!==Math.sign(clusterNow.preferredOffset-current) && clusterNow.confidence>.42)
            score += 3.25*clusterNow.confidence; // v4.54 avoid crossing into the pressured half
        }
        // v4.28 survival: never choose an escape click whose chord cuts outside the
        // route-derived legal ribbon. This is geometry-derived, not screenshot coordinates.
        const ex=p.x+s.ux*7.2+s.nx*off, ey=p.y+s.uy*7.2+s.ny*off;
        if(!courseContainsPoint(ex,ey,ROUTE_PLAN_EXTRA*.72) || !lineStaysOnCourse(p.x,p.y,ex,ey,ROUTE_PLAN_EXTRA*.78)) score+=18.0;
        // v4.24 action priors: natural diagonal > stop when a crossing lane will clear
        // > wide arc > occasional feint. Back is punished heavily unless truly boxed in.
        if(c.kind==='diag') score-=2.32+avoid*.60+(leaderNow?.52:0);
        // v4.57: if the leader must evade, prefer one clean forward diagonal arc.
        if(leaderNow && c.kind==='wide') score+=.34;
        if(leaderNow && c.kind==='zig') score+=1.65;
        if(leaderNow && c.kind==='spin') score+=2.10;
        if(leaderNow && c.kind==='stop') score+=9.0;
        if(leaderNow && c.kind==='back') score+=9.5;
        // v4.25: corner line and observer escape are one decision. Prefer candidates
        // that preserve useful progress toward the current racing/apex line.
        const raceDeviation=Math.abs(off-current)/Math.max(1,half);
        score += raceDeviation*(visualRouteBreak ? (tier>=3?.10:tier>=2?.20:.34) : (bestT>1.15?.52:.24)); // v4.61 preserve optimized race line when a smaller safe dodge exists
        if(c.kind==='wide' && bestT<1.95) score-=1.22;
        if(c.kind==='zig') score += (bothSidesBusy || clusterNow.frontCount>=2) ? -.18 : .72;
        if(c.kind==='spin') score += (!bothSidesBusy && bestT<1.05 && Math.abs(leftRisk-rightRisk)>.42) ? .18 : 1.38;
        // v4.53: keep commitment only if it remains competitive; safety beats stale side memory.
        if(c.side===preferred && corridor.minClear>1.75) score-=.28;
        if(c.kind==='stop') score += sparseField ? 28.0 : ((bestT<.25 && danger>1.85 && bothSidesBusy) ? 5.8 : 16.5);
        if(c.kind==='back') score += sparseField ? 30.0 : ((bestT<.24 && bothSidesBusy && clusterNow.frontCount>=2) ? .75 : 17.0);
        score+=(Math.random()-.5)*(1-skill)*.90;
        if(!best||score<best.score) best={...c,off,score};
      }
      if(best){
        // v4.61 OPTIMIZED ESCAPE: safety remains first, but a watch/danger dodge should
        // not abandon the racing line farther than necessary. If the chosen corridor has
        // comfortable clearance, pull it modestly back toward the optimized race offset.
        // Emergency/boxed situations keep the full escape width.
        if(!boxedNow && tier<3 && Number.isFinite(raceOff) && best.kind!=='stop' && best.kind!=='back'){
          const comfort=Math.min(best.minClear||9, 9);
          const safeComfort=comfort>3.15 || bestT>1.55;
          if(safeComfort){
            const keep=tier===1?.66:.78;
            best.off=raceOff+(best.off-raceOff)*keep;
            best.off=clampRoadOffset(Math.min(p.seg,segs.length-1),best.off,p);
          }
        }
        p.liveEvadeOffset=best.off;
        p.liveEvadeSpeed=best.spd;
        p.liveEvadeSide=best.side||p.liveEvadeSide||openSide;
        p.liveEvadeThreat=threatId;
        p.liveEvadePhase++;
        p.liveEvadeAction=best.kind;
        // v4.60 HARD ROUTE LOCK: preserve the selected empty corridor as the sole
        // steering reference while observer danger is active. The normal racing line
        // cannot overwrite this offset during the lock.
        if(best.kind!=='stop' && best.kind!=='back'){
          p.lockedEscapeOffset=best.off;
          p.lockedEscapeSide=best.side||openSide;
          p.lockedEscapeSpeed=Math.max(.97,best.spd);
          p.hardRouteLockUntil=Math.max(p.hardRouteLockUntil||0,now+780+pred*220+avoid*180);
        }
        const hold=best.kind==='stop' ? 48+Math.random()*34
          : best.kind==='back' ? 72+Math.random()*28
          : best.kind==='zig' ? 330+Math.random()*150
          : best.kind==='spin' ? 300+Math.random()*120
          : (sparseField?820:560)+Math.random()*(sparseField?260:230);
        p.liveEvadeUntil=now+hold;
        // v4.59.8: a forward diagonal/wide breakout is a real committed mouse move.
        // Hold it long enough to visibly clear the obstacle field; do not re-pick a
        // different observer every few frames. Skill changes the hold modestly.
        if(best.kind==='diag' || best.kind==='wide' || best.kind==='breakout'){
          const commitMs=(sparseField?760:650)+avoid*150+pred*120+ctrl*80+Math.random()*110;
          p.committedEscapeUntil=now+commitMs;
          p.committedEscapeOffset=best.off;
          p.committedEscapeSide=best.side||openSide;
          p.committedEscapeSpeed=Math.max(.94,best.spd);
          p.committedEscapeThreat=threatId;
          p.liveEvadeUntil=Math.max(p.liveEvadeUntil,p.committedEscapeUntil);
          p.liveEvadeNextThink=Math.max(p.liveEvadeNextThink,p.committedEscapeUntil-70);
        }
        // v4.57 EVADE CHAIN: keep context from first dodge through the next threat
        // and recovery. This gives detect -> dodge -> re-read -> optional second dodge
        // -> rejoin one continuous human-looking control sequence.
        p.evadeChainUntil=now+hold+520+pred*220+avoid*160;
        p.evadeChainSide=best.side||p.liveEvadeSide||openSide;
        p.evadeChainThreat=threatId;
        // v4.28: after a real dodge, keep the cleared lane briefly and rejoin gradually.
        // This prevents dodge-one-observer -> instant apex rejoin -> hit-next-observer deaths.
        if(best.kind!=='stop' && best.kind!=='back'){
          p.survivalRecoverStart=now+hold;
          p.survivalRecoverUntil=p.survivalRecoverStart+(sparseField?690:340)+avoid*(sparseField?245:175)+pred*(sparseField?205:135); // v4.59.5 hold the cleared lane through the next-threat check
          p.survivalRecoverOffset=best.off;
        }
        // v4.26: a stop is a tiny human tap, not a long decision lock. Re-read the
        // field almost immediately after releasing so STOP -> next click feels crisp.
        if(best.kind==='stop') p.liveEvadeNextThink=now+hold+14+Math.random()*24;
        p.match.avoids++;
      }
    }
    if(now<p.liveEvadeUntil){
      return {off:p.liveEvadeOffset,speedMul:p.liveEvadeSpeed,danger:p.liveEvadeDanger,side:p.liveEvadeSide};
    }
    // v4.33 SAFE REJOIN: after a dodge, re-check the personally perceived field before
    // curling back to the racing/apex line. If the next observer is closing across the
    // proposed rejoin chord, hold the already-cleared lane and keep moving. Rejoin only
    // after a short continuous safe window, then blend back gradually.
    if(now<(p.survivalRecoverUntil||0) || now<(p.survivalRejoinHoldUntil||0)){
      const rejoinRaw=playerPerceivedObservers(p,Math.min(25,p.visionRadius||25));
      const rejoinObs=nearestThreats(rejoinRaw,p,20);
      const back=Number.isFinite(raceOff)?raceOff:p.desiredOffset;
      const held=clampRoadOffset(Math.min(p.seg,segs.length-1),p.survivalRecoverOffset||0,p);
      const rejoinBias=Math.max(.78,Math.min(1.16,p.mouseRejoinBias||1));
      const baseSpan=Math.max(1,(p.survivalRecoverUntil||0)-(p.survivalRecoverStart||now));
      const rawT=Math.max(0,Math.min(1,(now-(p.survivalRecoverStart||now))/baseSpan));
      // High rejoin-bias racers still return faster, but nobody may ignore a closing threat.
      const pacedT=Math.pow(rawT,1.12/rejoinBias);
      const eased=pacedT*pacedT*(3-2*pacedT);
      const proposed=clampRoadOffset(Math.min(p.seg,segs.length-1),held*(1-eased)+back*eased,p);
      // v4.58 SAFE REJOIN AI: judge the whole return chord, not only the immediate
      // destination. A lane is considered safe only when it stays open across short,
      // medium and long horizons. This prevents dodge -> instant rejoin -> second hit.
      const holdRisk=scoreFutureEscapePath(p,s,held,1.0,rejoinObs);
      const joinRiskNear=scoreFutureEscapePath(p,s,proposed,.82,rejoinObs);
      const joinRiskMid=scoreFutureEscapePath(p,s,proposed,1.28,rejoinObs);
      const joinRiskFar=scoreFutureEscapePath(p,s,proposed,1.72,rejoinObs);
      const joinRiskChain=scoreFutureEscapePath(p,s,proposed,2.18,rejoinObs); // v4.59.5 do not rejoin between chained observers
      const joinMin=Math.min(joinRiskNear.minClear,joinRiskMid.minClear,joinRiskFar.minClear,joinRiskChain.minClear);
      const joinScore=Math.max(joinRiskNear.score,joinRiskMid.score*.96,joinRiskFar.score*.90,joinRiskChain.score*.84);
      const nextThreatClosing=rejoinObs.some(o=>{
        const rx=o.x-p.x, ry=o.y-p.y;
        const rvx=(o.vx||0)-(p.vx||0), rvy=(o.vy||0)-(p.vy||0);
        return rx*rvx+ry*rvy<0 && Math.hypot(rx,ry)<11.8;
      });
      const leaderRejoin=liveRaceSituation(p).rank===1;
      // Leaders may return a little sooner when the corridor is genuinely clear, but
      // never cut through a closing observer just to protect first place.
      const minNeed=leaderRejoin?2.05:2.17; // v4.59.5 preserve a small safety buffer during recovery
      const scoreSlack=leaderRejoin?.64:.54;
      const joinBad=rejoinObs.length && (joinMin<minNeed || joinScore>holdRisk.score+scoreSlack || (nextThreatClosing && joinMin<2.35));
      p.survivalRejoinLastRisk=joinScore||0;
      if(joinBad){
        p.survivalRejoinClearSince=0;
        const extra=nextThreatClosing?340:285;
        p.survivalRejoinHoldUntil=Math.max(p.survivalRejoinHoldUntil||0,now+extra);
        p.survivalRecoverUntil=Math.max(p.survivalRecoverUntil||0,now+extra+45);
        p.liveEvadeAction='recover-hold';
        return {off:held,speedMul:1.012,danger:Math.max(p.liveEvadeDanger*.30,.16),side:p.liveEvadeSide};
      }
      if(!p.survivalRejoinClearSince) p.survivalRejoinClearSince=now;
      const clearNeed=(leaderRejoin?190:225)+(1-avoid)*78+(1-pred)*68; // v4.59.5 confirm the lane before returning
      if(now-p.survivalRejoinClearSince<clearNeed){
        p.liveEvadeAction='recover-check';
        return {off:held,speedMul:1.008,danger:p.liveEvadeDanger*.25,side:p.liveEvadeSide};
      }
      // Blend back more gently. Even after confirmation, never snap straight to apex.
      const blendCap=leaderRejoin?.62:.49; // v4.59.5 softer recovery angle
      const safeBlend=Math.min(blendCap,.22+rawT*.40);
      const safeProposed=clampRoadOffset(Math.min(p.seg,segs.length-1),held*(1-safeBlend)+proposed*safeBlend,p);
      p.liveEvadeAction='recover';
      return {off:safeProposed,speedMul:1.005,danger:p.liveEvadeDanger*.22,side:p.liveEvadeSide};
    }
    p.survivalRejoinClearSince=0;
    p.survivalRejoinHoldUntil=0;
    p.liveEvadeAction='none';
    p.liveEvadeSpeed=1;
    return null;
  }

  
  
  // v4.68 DRIVER STYLE 2.0:
  // Styles no longer choose intentionally slow macro routes. They change how precisely
  // and how boldly each racer executes the same shortest inside line.
  
  // v4.70-v4.74 INTEGRATED FAST-RACE AI
  // 4.70 inside-line 3.0 / 4.71 turn-in timing 3.0 / 4.72 linked corners 3.0
  // 4.73 straight driving 2.0 / 4.74 leader AI 3.0.
  function linkedCornerPlan74(si,maxLook=4){
    const out=[];
    for(let k=0;k<=maxLook;k++){
      const sj=Math.min(segs.length-1,si+k);
      const power=cornerIntensity(sj),side=cornerInsideSide(sj);
      if(side && power>.028) out.push({sj,gap:k,power,side});
    }
    return out;
  }

  function integratedFastLine74(p,si,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx],half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const rx=p.x-s.a[0],ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L?along/s.L:1;
    const corners=linkedCornerPlan74(idx,4);
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const precision=insideN*.34+cornerN*.29+readN*.22+controlN*.15;
    let target=baseOff,authority=.82;

    if(corners.length){
      const c=corners[0];
      // 4.71: turn in only when the inside line is geometrically useful; no early exterior setup.
      const approach=Math.max(0,Math.min(1,(4.15-c.gap)/4.15));
      const edge=Math.min(.998,.925+precision*.068);
      const insideTarget=c.side*half*edge;
      if(c.gap===0){
        const turnIn=Math.max(0,Math.min(1,(phase+.10)/.28));
        target=baseOff*(1-turnIn)+insideTarget*turnIn;
        authority=.91+precision*.06;
      }else{
        target=insideTarget;
        authority=Math.min(.94,.42+approach*.43+readN*.07);
      }

      // 4.72: linked corners are one sequence. Stay on current inside for same-direction
      // bends; cross toward the next inside only late enough for an opposite S-bend.
      const next=corners.find(x=>x.sj>c.sj);
      if(next && c.gap===0){
        if(next.side===c.side){
          target=insideTarget;
          authority=Math.max(authority,.94);
        }else if(phase>.76){
          const t=Math.min(1,(phase-.76)/.24);
          const nextInside=next.side*half*(.78+readN*.15);
          target=insideTarget*(1-t*.52)+nextInside*(t*.52);
        }
      }
    }else{
      // 4.73: straight = shortest stable continuation. No decorative lane weaving.
      target=baseOff;
      authority=.94;
    }
    return clampRoadOffset(idx,baseOff*(1-authority)+target*authority,p);
  }

function driverStyle68Line(p,si,baseOff,passActive=false){
    if(passActive) return baseOff; // a genuine pass may temporarily need another corridor
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const side=cornerInsideSide(idx);
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const id=identityOf(p);
    const styleTight=Math.max(-.025,Math.min(.030,(id.apex-1)*.12));
    const precision=insideN*.34+cornerN*.28+controlN*.20+readN*.18;

    if(side && cornerIntensity(idx)>.028){
      const commit=Math.min(.998,.900+precision*.078+styleTight);
      const target=side*half*commit;
      const authority=Math.min(.96,.82+precision*.11);
      return clampRoadOffset(idx,baseOff*(1-authority)+target*authority,p);
    }

    // On the approach straight, attach to the upcoming inside early rather than
    // preparing from the outside. This reproduces the short-path Observer Dodge feel.
    const future=nextMeaningfulCorner64(idx,4);
    if(future){
      const commit=Math.min(.965,.72+insideN*.12+readN*.10+styleTight);
      const target=future.side*half*commit;
      const proximity=Math.max(0,1-(future.gap-1)/4);
      const authority=Math.min(.90,.42+proximity*.38+readN*.08);
      return clampRoadOffset(idx,baseOff*(1-authority)+target*authority,p);
    }
    return baseOff;
  }

function leaderLineDiscipline67(p,si){
    const rs=liveRaceSituation(p);
    const macro=optimalRacingLine2Offset(p,si);
    // v4.68: leader discipline follows the shortest-inside refined route as well.
    const soloBase=cornerPhysics64Target(p,si,macro).off;
    const solo74=integratedFastLine74(p,si,soloBase);
    const solo=raceLine79(p,si,solo74,false);
    const leadBattle=(rs.rank===1 && rs.nearestBehindGap<7.5) ||
                     (rs.rank===2 && rs.nearestAheadGap<7.5);
    return {rs,solo,leadBattle};
  }

  // v4.67 SURVIVAL × RACING UNIFIED POLICY:
  // Avoidance may leave the fast line only when the predicted threat justifies it.
  // Leaders/P2 in a close fight pay an extra route-cost penalty, so they make compact
  // dodges and return to the racing line immediately instead of taking huge arcs.
  function unifiedLine67(p,si,baseOff,avoid){
    const info=leaderLineDiscipline67(p,si);
    if(!avoid) return {off:baseOff,speedMul:1};
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    const deviation=Math.abs(avoid.targetOff-info.solo);
    const maxNormal=half*.58; // v4.81 minimum-dodge cap
    const maxLead=half*.40; // v4.82 leaders preserve inside line
    const cap=info.leadBattle?maxLead:maxNormal;
    let off=avoid.targetOff;
    if(deviation>cap){
      off=info.solo+Math.sign(avoid.targetOff-info.solo)*cap;
    }
    // Only true close-clearance emergencies may use more of the road.
    // Avoidance risk scores are not normalized, so minimum predicted clearance is
    // the reliable signal for whether a larger dodge is genuinely necessary.
    const emergency=(Number.isFinite(avoid.minClear) && avoid.minClear<.90) ||
                    avoid.mode==="stop";
    if(emergency){
      const emergencyCap=info.leadBattle?half*.66:half*.86;
      const d=avoid.targetOff-info.solo;
      off=info.solo+Math.sign(d)*Math.min(Math.abs(d),emergencyCap);
    }
    return {off,speedMul:avoid.speedMul||1};
  }

function chooseAvoidanceLegacy84(p,s,now){
    if(safeAt(p.x,p.y)){
      p.avoidPlanUntil=0;
      return null;
    }

    // Keep the current decision briefly so overlapping racers do not trigger
    // frame-by-frame left/right oscillation.
    if(now < p.avoidPlanUntil){
      return {
        mode:p.avoidPlanSpeedMul<=0.03 ? "stop" : "planned",
        targetOff:p.avoidPlanOffset,
        speedMul:p.avoidPlanSpeedMul,
        risk:p.avoidPlanRisk
      };
    }

    const pack=packAwareness(p,s);
    const packVisionBoost=pack.mates>=2 ? 1.18+pack.density*.12 : 1;
    const ownVision=Math.min(AVOID_SCAN_RADIUS,(p.visionRadius||AVOID_SCAN_RADIUS)*packVisionBoost);
    const nearbyRaw=playerPerceivedObservers(p,ownVision);
    // v4.19 CLOSE-REACTION GATE: do not pre-dodge observers far down the road.
    // A human-like racer keeps the optimized line until an observer is genuinely close.
    const imminentRaw=nearbyRaw.filter(o=>{
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=Math.abs(dx*s.nx+dy*s.ny);
      const d=Math.hypot(dx,dy);
      // v4.40 survival-first: begin reading obvious front threats before the last-second zone.
      // This is deliberately wider than the old gate; physical collision remains HIT 0.56.
      return d<8.8 || (along>-2.4 && along<15.0 && lat<7.8);
    });
    if(!imminentRaw.length){ p.avoidPlanUntil=0; return null; }
    const sharedRaw=imminentRaw.filter(o=>{
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=Math.abs(dx*s.nx+dy*s.ny);
      return Math.hypot(dx,dy)<9.1 || (along>-2.4 && along<15.3 && lat<8.0);
    });
    if(!sharedRaw.length) return null;

    // v3.63: a pack tracks a broader slice of the obstacle field. Solo behavior
    // stays essentially unchanged; dense packs keep up to nine meaningful threats.
    const threatLimit=pack.mates>=3?20:pack.mates>=2?17:14;
    const nearby=nearestThreats(sharedRaw,p,threatLimit);

    // v4.59.1 LONE-OBSERVER SURVIVAL HOTFIX:
    // One readable observer on the racing corridor is a mandatory fundamentals dodge,
    // even when all 8 racers overlap. Do not let pack state or leader pace suppress it.
    const loneFront=[];
    const loneRoadHalf=Math.max(2.4,widths[Math.min(p.seg,widths.length-1)]*ROAD_MARGIN);
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy, lat=dx*s.nx+dy*s.ny;
      if(along>-.35 && along<20.5 && Math.abs(lat)<Math.min(8.8,loneRoadHalf*1.18)){
        const rvx=(o.vx||0)-s.ux*p.speed, rvy=(o.vy||0)-s.uy*p.speed;
        const rv2=rvx*rvx+rvy*rvy;
        let tc=99,cpa=99;
        if(rv2>.01){
          tc=Math.max(0,Math.min(4.10,-(dx*rvx+dy*rvy)/rv2));
          cpa=Math.hypot(dx+rvx*tc,dy+rvy*tc);
        }
        const closingDot=dx*rvx+dy*rvy;
        // v4.59.3 PRECISION SURVIVAL: do not flee merely because one observer is visually ahead.
        // Commit early only when closest-approach predicts collision, or when a stationary/slow
        // obstacle truly occupies the forward lane. This trims cowardly over-avoidance.
        const direct=Math.abs(lat)<3.85 && along<18.6 && (closingDot<0 || Math.hypot(o.vx||0,o.vy||0)<.35);
        if((tc<3.82 && cpa<4.18) || direct) loneFront.push({o,along,lat,tc,cpa});
      }
    }
    if(loneFront.length===1){
      const th=loneFront[0];
      const skill=Math.max(0,Math.min(1,(((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4)-72)/27));
      const leadT=Math.max(.72,Math.min(2.9,th.tc<90?th.tc:th.along/Math.max(4.8,p.speed)));
      const predX=predictedObserverX(th.o,leadT), predY=predictedObserverY(th.o,leadT);
      const predLat=(predX-p.x)*s.nx+(predY-p.y)*s.ny;
      const clearance=4.38+skill*.78; // v4.59.3 survival-first: sacrifice a little optimal line for a clean pass
      const leftTarget=clampRoadOffset(Math.min(p.seg,widths.length-1),predLat-clearance,p);
      const rightTarget=clampRoadOffset(Math.min(p.seg,widths.length-1),predLat+clearance,p);
      const leftRisk=candidateAvoidanceRisk(p,s,leftTarget,.998,nearby);
      const rightRisk=candidateAvoidanceRisk(p,s,rightTarget,.998,nearby);
      let chosen=leftRisk.score<=rightRisk.score?{off:leftTarget,r:leftRisk}:{off:rightTarget,r:rightRisk};
      // If both candidate scores are close, use a persistent per-racer side signature so
      // eight overlapping racers do not all choose the exact same dodge arc.
      if(Math.abs(leftRisk.score-rightRisk.score)<1.55){
        // Persistent racer signature rather than per-frame randomness. routeBand/style make
        // an overlapping pack split naturally without turning the dodge into random noise.
        const signature=(p.routeBand||0)+(p.openingLineBias||0)*.65+(p.index%2?.18:-.18);
        const sig=signature===0?((p.index||0)%2?-1:1):Math.sign(signature);
        chosen=sig<0?{off:leftTarget,r:leftRisk}:{off:rightTarget,r:rightRisk};
      }
      if(chosen.r.minClear>.96){
        p.avoidPlanOffset=chosen.off;
        p.avoidPlanSpeedMul=.998;
        p.avoidPlanRisk=chosen.r.score;
        p.avoidPlanUntil=now+Math.max(980,Math.min(1580,th.along*92)); // v4.59.3 commit to the safe side; less left-right wobble
        p.avoidLastSide=Math.sign(chosen.off-p.desiredOffset)||p.avoidLastSide||1;
        p.avoidExitSide=p.avoidLastSide;
        p.avoidExitUntil=p.avoidPlanUntil+900;
        p.avoidSideLockUntil=p.avoidPlanUntil+180; // v4.59.3 keep chosen side unless new danger clearly invalidates it
        p.match.avoids++; p.match.simpleDodges=(p.match.simpleDodges||0)+1;
        return {mode:"planned",targetOff:chosen.off,speedMul:.998,risk:chosen.r.score,minClear:chosen.r.minClear,loneObserverHotfix:true};
      }
    }

    // v3.6 SIMPLE READ DODGE:
    // If exactly one observer is the only meaningful front threat and there is
    // open road on either side, read its predicted motion early and glide around
    // it. This branch intentionally avoids stop/back controls on an easy road.
    const simpleFront=[];
    const simpleRoadHalf=Math.max(2.4,widths[Math.min(p.seg,widths.length-1)]*ROAD_MARGIN);
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=dx*s.nx+dy*s.ny;
      if(along>.15 && along<14.4 && Math.abs(lat)<Math.min(7.2,simpleRoadHalf*1.04)){
        simpleFront.push({o,along,lat});
      }
    }
    if(simpleFront.length===1 && pack.mates<2){
      const th=simpleFront[0];
      // Do not call this "easy" if another observer is close enough to interfere
      // with either escape lane.
      let interfering=0;
      for(const o of nearby){
        if(o===th.o) continue;
        const dx=o.x-p.x,dy=o.y-p.y;
        const along=dx*s.ux+dy*s.uy;
        const lat=Math.abs(dx*s.nx+dy*s.ny);
        if(along>-1.5 && along<13.8 && lat<simpleRoadHalf*1.14) interfering++;
      }
      if(interfering===0){
        const skill=Math.max(0,Math.min(1,
          (((p.stats.avoidance+p.stats.reaction+p.stats.prediction+p.stats.control)/4)-72)/27));
        const leadT=Math.max(.72,Math.min(2.65,th.along/Math.max(4.8,p.speed)));
        const predX=predictedObserverX(th.o,leadT);
        const predY=predictedObserverY(th.o,leadT);
        const pdx=predX-p.x,pdy=predY-p.y;
        const predLat=pdx*s.nx+pdy*s.ny;
        // v4.40 virtual safety radius: on an open road, do not skim an isolated observer.
        const clearance=3.55+skill*.78;
        const leftTarget=Math.max(-simpleRoadHalf*.97,Math.min(simpleRoadHalf*.97,predLat-clearance));
        const rightTarget=Math.max(-simpleRoadHalf*.97,Math.min(simpleRoadHalf*.97,predLat+clearance));
        const leftRisk=candidateAvoidanceRisk(p,s,leftTarget,.995,nearby);
        const rightRisk=candidateAvoidanceRisk(p,s,rightTarget,.995,nearby);
        const chosen=leftRisk.score<=rightRisk.score
          ? {off:leftTarget,r:leftRisk}
          : {off:rightTarget,r:rightRisk};

        // Skilled racers should almost never miss an isolated, obvious observer.
        // Lower-skill racers retain a small human-like error chance.
        // v4.40: isolated readable observers are a fundamentals check, not a dice roll.
        // If a legal lane has real clearance, commit to it deterministically.
        if(chosen.r.minClear>1.20){
          p.avoidPlanOffset=chosen.off;
          p.avoidPlanSpeedMul=.995;
          p.avoidPlanRisk=chosen.r.score;
          p.avoidPlanUntil=now+Math.max(720,Math.min(1280,th.along*78));
          p.avoidLastSide=Math.sign(chosen.off-p.desiredOffset)||p.avoidLastSide||1;
          p.avoidExitSide=p.avoidLastSide;
          p.avoidExitUntil=p.avoidPlanUntil+720;
          p.avoidSideLockUntil=p.avoidPlanUntil;
          p.match.avoids++;
          p.match.simpleDodges=(p.match.simpleDodges||0)+1;
          return {mode:"planned",targetOff:chosen.off,speedMul:.995,
            risk:chosen.r.score,minClear:chosen.r.minClear,simpleDodge:true};
        }
      }
    }

    // v3.63 PACK SURVIVAL: when racers overlap, make the obstacle-field decision
    // before individual reactive controls. The safest corridor is risk-tested against
    // shared observer predictions and held longer to prevent an entire pack from
    // marching down one doomed line.
    if(pack.mates>=2){
      const cp=observerClusterPlan(p,s,nearby);
      if(cp.frontCount>=1 || cp.closeCount>=1){
        const roadHalf=Math.max(2.4,widths[Math.min(p.seg,widths.length-1)]*ROAD_MARGIN);
        const bias=(p.index%3-1)*roadHalf*.055; // tiny deterministic diversity, not body avoidance
        const packTarget=clampRoadOffset(Math.min(p.seg,widths.length-1),cp.preferredOffset+bias,p);
        const pr=candidateAvoidanceRisk(p,s,packTarget,.982,nearby);
        if(pr.minClear>.72 || cp.emergency){
          p.avoidPlanOffset=packTarget;
          p.avoidPlanSpeedMul=cp.emergency?.965:.982;
          p.avoidPlanRisk=pr.score;
          p.avoidPlanUntil=now+390+pack.density*260+Math.random()*90;
          p.avoidLastSide=Math.sign(packTarget-p.desiredOffset)||p.avoidLastSide||1;
          p.avoidExitSide=p.avoidLastSide;
          p.avoidExitUntil=p.avoidPlanUntil+360;
          p.avoidSideLockUntil=p.avoidPlanUntil;
          p.match.avoids++;
          p.match.packDodges=(p.match.packDodges||0)+1;
          return {mode:"planned",targetOff:packTarget,speedMul:p.avoidPlanSpeedMul,
            risk:pr.score,minClear:pr.minClear,packSurvival:true};
        }
      }
    }

    // v3.35: visible observer danger has priority over the optimized racing line.
    // The racer commits to a smooth lateral survival line first, then rejoins the racing line.
    const survivalWeave=naturalSurvivalWeave(p,s,now,nearby);
    if(survivalWeave){
      p.avoidPlanOffset=survivalWeave.targetOff;
      p.avoidPlanSpeedMul=survivalWeave.speedMul;
      p.avoidPlanRisk=12+survivalWeave.front*5;
      p.avoidPlanUntil=survivalWeave.until;
      p.avoidLastSide=Math.sign(survivalWeave.targetOff-p.desiredOffset)||p.avoidLastSide;
      p.avoidExitSide=p.avoidLastSide;
      p.avoidExitUntil=survivalWeave.until+360;
      p.match.avoids++;
      return {mode:"planned",targetOff:survivalWeave.targetOff,speedMul:survivalWeave.speedMul,
        risk:p.avoidPlanRisk,survivalWeave:true};
    }

    // v3.0 consecutive dodge combo: when several observers form a chain ahead,
    // commit to one flowing left-right escape sequence instead of recalculating
    // an unrelated direction for each observer.
    if(now<p.comboDodgeUntil){
      const elapsed=1-(p.comboDodgeUntil-now)/760;
      const wave=Math.sin(Math.max(0,Math.min(1,elapsed))*Math.PI*1.45);
      const comboOff=p.comboDodgeOffset + wave*p.comboDodgeSide*Math.max(1.2,widths[Math.min(p.seg,widths.length-1)]*.18);
      return {mode:"planned",targetOff:comboOff,speedMul:.985,risk:18,combo:true,minClear:2.0};
    }
    let chainedFront=0;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy,lat=Math.abs(dx*s.nx+dy*s.ny);
      if(along>1.0&&along<13.5&&lat<widths[Math.min(p.seg,widths.length-1)]*.72) chainedFront++;
    }
    if(chainedFront>=3 && now>=p.comboDodgeUntil){
      const half=Math.max(2.2,widths[Math.min(p.seg,widths.length-1)]*.55);
      let leftRisk=0,rightRisk=0;
      for(const o of nearby){
        const dx=o.x-p.x,dy=o.y-p.y,along=dx*s.ux+dy*s.uy;
        if(along<=0||along>12) continue;
        const lat=dx*s.nx+dy*s.ny;
        if(lat<0) leftRisk++; else rightRisk++;
      }
      p.comboDodgeSide=leftRisk<=rightRisk?-1:1;
      p.comboDodgeOffset=p.comboDodgeSide*half*.72;
      p.comboDodgeUntil=now+620+Math.random()*140;
      p.avoidSideLockUntil=Math.max(p.avoidSideLockUntil,p.comboDodgeUntil);
      p.match.avoids++;
      return {mode:"planned",targetOff:p.comboDodgeOffset,speedMul:.985,risk:24,combo:true,minClear:1.8};
    }

    const predictionNorm=(p.stats.prediction-72)/27;
    const corridorBias=escapeCorridorBias(p,s,nearby);
    const clusterPlan=observerClusterPlan(p,s,nearby);
    const exitPlan=escapeGatePlan(p,s,nearby);
    if(exitPlan && clusterPlan.frontCount>=2 && exitPlan.minClear>.95){
      p.avoidPlanOffset=exitPlan.targetOff;
      p.avoidPlanSpeedMul=exitPlan.speedMul;
      p.avoidPlanRisk=exitPlan.score;
      p.avoidPlanUntil=now+260+Math.random()*130;
      p.avoidLastSide=Math.sign(exitPlan.targetOff-p.desiredOffset)||p.avoidLastSide;
      p.match.avoids++;
      return {mode:"planned",targetOff:exitPlan.targetOff,speedMul:exitPlan.speedMul,
        risk:exitPlan.score,minClear:exitPlan.minClear,escapeGate:true};
    }
    const corridorCommit=Math.min(.44,
      Math.abs(corridorBias)*(.14+predictionNorm*.11) +
      clusterPlan.confidence*(.16+predictionNorm*.10));

    // Fast pre-check. If nothing is remotely threatening, keep the racing line.
    let nearestSq=Infinity;
    let nearestFutureSq=Infinity;
    const px3=p.x+s.ux*p.speed*AVOID_PREDICT_SEC;
    const py3=p.y+s.uy*p.speed*AVOID_PREDICT_SEC;
    for(const o of nearby){
      const ndx=o.x-p.x, ndy=o.y-p.y;
      const d2=ndx*ndx+ndy*ndy;
      if(d2<nearestSq) nearestSq=d2;
      const ox=predictedObserverX(o,AVOID_PREDICT_SEC);
      const oy=predictedObserverY(o,AVOID_PREDICT_SEC);
      const fdx=ox-px3, fdy=oy-py3;
      const fd2=fdx*fdx+fdy*fdy;
      if(fd2<nearestFutureSq) nearestFutureSq=fd2;
    }
    const nearest=Math.sqrt(nearestSq);
    const nearestFuture=Math.sqrt(nearestFutureSq);
    if(nearestSq>240.25 && nearestFutureSq>144.0){
      p.avoidPlanUntil=0;
      p.avoidClearSince=p.avoidClearSince||now;
      // Once the obstacle field is clearly gone, release avoidance quickly.
      // The normal racing-line planner retakes control instead of lingering off-line.
      if(now-p.avoidClearSince>140){
        p.avoidExitUntil=0;
        p.avoidLastSide=0;
      }
      return null;
    }
    p.avoidClearSince=0;

    const si=Math.min(p.seg,segs.length-1);
    const evadeSkill=(p.stats.avoidance+p.stats.reaction+p.stats.prediction)/3;
    const reactionNorm=(p.stats.reaction-72)/27;
    const controlNorm=(p.stats.control-72)/27;
    const compactSkill=(reactionNorm+predictionNorm+controlNorm)/3;
    const evadeNorm=(evadeSkill-72)/27;
    const survivalWide=1+(p.survivalNorm||0)*.16;
    const half=Math.max(3.6,widths[si]*(0.675-compactSkill*0.070+evadeNorm*0.035)*p.drivingStyle.safety*survivalWide);

    // v2.60 GAP PASS: if two observers leave a calculably safe window,
    // thread the midpoint before falling back to a larger avoidance detour.
    const gapPlan=observerGapPassPlan(p,s,nearby);
    if(gapPlan && nearest>2.25){
      const gr=candidateAvoidanceRisk(p,s,gapPlan.targetOff,gapPlan.speedMul,nearby);
      const needed=.78+(p.survivalNorm||0)*.18;
      if(gr.minClear>needed){
        p.avoidPlanOffset=gapPlan.targetOff;
        p.avoidPlanSpeedMul=gapPlan.speedMul;
        p.avoidPlanRisk=gr.score;
        p.avoidPlanUntil=now+240+Math.random()*110;
        p.avoidLastSide=Math.sign(gapPlan.targetOff-p.desiredOffset)||p.avoidLastSide;
        p.match.avoids++;
        return {mode:"planned",targetOff:gapPlan.targetOff,speedMul:gapPlan.speedMul,risk:gr.score,gapPass:true};
      }
    }

    // v2.45 DIAGONAL SKIM DODGE:
    // When an observer is directly ahead, prefer a quick diagonal slip-by instead
    // of braking/stop-control. Both sides are risk-tested; avoidance remains safe.
    let frontThreat=null,frontAlong=Infinity,frontLat=0;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=dx*s.nx+dy*s.ny;
      if(along>0 && along<10.2 && Math.abs(lat)<3.4 && along<frontAlong){
        frontThreat=o;frontAlong=along;frontLat=lat;
      }
    }
    if(frontThreat && now>=p.skimDodgeCooldown){
      const skimChance=Math.min(.995,(.88+reactionNorm*.055+predictionNorm*.045+controlNorm*.025)*signatureOf(p).skim);
      if(Math.random()<skimChance){
        const sidePref=frontLat>=0?-1:1;
        const skimMag=half*(.58+compactSkill*.15);
        const candA=Math.max(-half*.98,Math.min(half*.98,p.desiredOffset+sidePref*skimMag));
        const candB=Math.max(-half*.98,Math.min(half*.98,p.desiredOffset-sidePref*skimMag*.88));
        const riskA=candidateAvoidanceRisk(p,s,candA,.97,nearby);
        const riskB=candidateAvoidanceRisk(p,s,candB,.95,nearby);
        const chosen=riskA.score<=riskB.score
          ? {targetOff:candA,speedMul:.99,risk:riskA}
          : {targetOff:candB,speedMul:.98,risk:riskB};
        if(chosen.risk.minClear>.80 || Math.min(riskA.score,riskB.score)<210){
          p.avoidPlanOffset=chosen.targetOff;
          p.avoidPlanSpeedMul=chosen.speedMul;
          p.avoidPlanRisk=chosen.risk.score;
          p.avoidLastSide=Math.sign(chosen.targetOff-p.desiredOffset)||sidePref;
          p.avoidExitSide=p.avoidLastSide;
          p.avoidExitUntil=now+430;
          p.avoidSideLockUntil=now+250;
          p.avoidPlanUntil=now+210+Math.random()*120;
          p.skimDodgeCooldown=now+360+Math.random()*340;
          p.match.avoids++;
          return {mode:"planned",targetOff:chosen.targetOff,speedMul:chosen.speedMul,risk:chosen.risk.score,skim:true};
        }
      }
      p.skimDodgeCooldown=now+180+Math.random()*220;
    }

    // Candidate lanes + speed choices. The planner chooses the safest path that
    // costs the least race time. Stop is evaluated only as an emergency option.
    const laneFracs=clusterPlan.density>.38
      ? [-1.10,-1.02,-.94,-.86,-.76,-.66,-.56,-.46,-.36,-.26,-.16,-.08,0,.08,.16,.26,.36,.46,.56,.66,.76,.86,.94,1.02,1.10]
      : [-1.08,-.98,-.88,-.78,-.68,-.58,-.48,-.38,-.28,-.18,-.09,0,.09,.18,.28,.38,.48,.58,.68,.78,.88,.98,1.08];
    const movingSpeeds=clusterPlan.emergency ? [1.045,1.01,.97,.91,.84] : [1.045,1.015,.98,.93];
    let best=null;

    for(const frac of laneFracs){
      const targetOff=frac*half;
      for(const sm of movingSpeeds){
        const r=candidateAvoidanceRisk(p,s,targetOff,sm,nearby);
        const rollout=rolloutActionRisk(p,s,targetOff,sm,nearby);
        const side=Math.sign(targetOff);
        const corridorBonus=(side!==0 && Math.sign(corridorBias)===side) ? corridorCommit*7.2 : 0;
        const clusterDistance=Math.abs(targetOff-clusterPlan.preferredOffset)/Math.max(1,half);
        const clusterBonus=(1-Math.min(1,clusterDistance))*clusterPlan.confidence*(clusterPlan.frontCount>=3?18.5:13.0);
        const centerPenalty=(clusterPlan.frontCount>=3 && Math.abs(frac)<.20)
          ? clusterPlan.density*7.5 : 0;
        const candidate={
          mode:"planned",
          targetOff,
          speedMul:sm,
          score:r.score*.22+rollout.score*.78-corridorBonus-clusterBonus+centerPenalty,
          minClear:Math.min(r.minClear,rollout.minClear)
        };
        if(!best || candidate.score<best.score) best=candidate;
      }
    }

    // v2.7 moving-avoidance only: the generic planner must never create an
    // unexplained full stop. Full stopping is reserved for the extremely rare
    // explicit stopcon or a real observer collision.
    const riskClearance=Math.max(.98,1.15-(p.tacticalRisk||0)*.22+(p.survivalNorm||0)*.24);
    if(!best){
      best={mode:"planned",targetOff:p.desiredOffset,speedMul:.82,score:999,minClear:0};
    }
    if(best.speedMul<=0) best.speedMul=.72;

    // No meaningful danger: don't disturb the optimal racing line.
    if(best && best.minClear>8.8 && best.score<8.0 && nearest>10.5){
      p.avoidPlanUntil=0;
      return null;
    }

    // Persist 320–560 ms. Very dangerous situations re-plan sooner.
    const emergency=clusterPlan.emergency || best.minClear<2.7 || nearest<5.0;
    const chosenSide=Math.sign(best.targetOff);
    if(!emergency && chosenSide!==0 && p.avoidLastSide!==0 &&
       chosenSide!==p.avoidLastSide && now<p.avoidSideLockUntil){
      best.targetOff=Math.abs(best.targetOff)*p.avoidLastSide;
      best.score+=1.8;
    }
    if(Math.sign(best.targetOff)!==0){
      p.avoidLastSide=Math.sign(best.targetOff);
      p.avoidExitSide=p.avoidLastSide;
      p.avoidExitUntil=now+(emergency?420:720);
      const stable=(p.stats.stability-72)/27;
      p.avoidSideLockUntil=now+(emergency?190:500+stable*170);
    }

    const react=(p.stats.reaction+p.stats.prediction)/2;
    const smooth=(p.stats.control+p.stats.stability)/2;
    const baseHold=500+(smooth-85)*5;
    if(Math.abs(corridorBias)>.12 || clusterPlan.confidence>.16){
      const roadHalf=Math.max(1.8,widths[Math.min(p.seg,widths.length-1)]*.55);
      const legacyTarget=corridorBias*roadHalf;
      const clusterTarget=Math.max(-roadHalf,Math.min(roadHalf,clusterPlan.preferredOffset));
      const clusterBlend=Math.min(.52,.18+clusterPlan.confidence*.34);
      const legacyBlend=Math.min(.18,Math.abs(corridorBias)*.14);
      best.targetOff=best.targetOff*(1-clusterBlend-legacyBlend)
        +clusterTarget*clusterBlend+legacyTarget*legacyBlend;
    }
    p.avoidPlanOffset=best.targetOff;
    p.avoidPlanSpeedMul=best.speedMul;
    p.avoidPlanRisk=best.score;
    p.match.avoids++;
    const clusterHold=clusterPlan.confidence>.30 ? 120+clusterPlan.confidence*170 : 0;
    p.avoidPlanUntil=now+(emergency
      ? Math.max(185,265-(react-85)*4)+Math.random()*65
      : Math.max(350,baseHold+clusterHold)+Math.random()*130);
    return best;
  }



  function racerPressureLevel(p){
    if(!p || p.done) return 0;
    const my=currentProgress(p);
    let nearest=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=Math.abs(currentProgress(q)-my);
      if(gap<nearest) nearest=gap;
    }
    return Math.max(0,Math.min(1,(5.0-nearest)/4.6));
  }

  function pressureLineAdjustment(p,si,now,baseOff){
    const pressureLevel=racerPressureLevel(p);
    p.livePressure=pressureLevel;
    if(pressureLevel<=.02) return baseOff;
    const pressureSkill=(p.stats.pressure-72)/27;
    const focus=(p.stats.focus-72)/27;
    const consistency=(p.stats.consistency-72)/27;
    const aggression=(p.stats.aggression-72)/27;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const composure=Math.max(0,Math.min(1,pressureSkill*.48+focus*.32+consistency*.20));
    const wobble=pressureLevel*(1-composure)*half*.055;
    let off=baseOff+Math.sin(now*.0063+p.index*1.71)*wobble;
    const side=cornerInsideSide(si)||Math.sign(futureInsideBias(si));
    if(side && composure>.60 && aggression>.55){
      const attack=pressureLevel*(.025+.035*aggression);
      off=off*(1-attack)+(side*half*.96)*attack;
    }
    return off;
  }

  function liveRaceSituation(p){
    const my=currentProgress(p);
    let rank=1;
    let nearestAheadGap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p) continue;
      const qp=currentProgress(q);
      if(qp>my) rank++;
      const gap=qp-my;
      if(gap>0 && gap<nearestAheadGap) nearestAheadGap=gap;
    }
    let nearestBehindGap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=my-currentProgress(q);
      if(gap>0 && gap<nearestBehindGap) nearestBehindGap=gap;
    }
    const ratio=Math.max(0,Math.min(1,my/routeLength));
    const state=rank===1
      ? (nearestBehindGap<4.8 ? "LEADER_DEFEND" : "LEADER_CONTROL")
      : (ratio>.78 ? "CLUTCH_CHASE" : (nearestAheadGap<5.2 ? "CHASE" : "RACE"));
    return {rank,progress:my,remaining:Math.max(0,routeLength-my),nearestAheadGap,nearestBehindGap,ratio,state};
  }

  function tacticalRiskLevel(p,now){
    if(now<p.tacticalRiskUntil) return p.tacticalRisk;
    if(now<p.tacticalRiskCooldown) return p.tacticalRisk;

    const rs=liveRaceSituation(p);
    const progressRatio=Math.max(0,Math.min(1,rs.progress/routeLength));
    const aggression=(p.stats.aggression-72)/27;
    const pressure=(p.stats.pressure-72)/27;
    const riskControl=(p.stats.riskControl-72)/27;
    const prediction=(p.stats.prediction-72)/27;

    // No rubber-band speed boost: trailing racers only accept slightly riskier routes.
    const rankNeed=Math.max(0,(rs.rank-3)/5);
    const lateNeed=Math.max(0,(progressRatio-.58)/.42);
    const passChance=rs.nearestAheadGap<5.0 ? .12 : 0;
    let risk=.04 + aggression*.10 + pressure*.06 + rankNeed*(.14+.18*lateNeed) + passChance;
    // v4.46: Risk Control must REDUCE reckless route acceptance, not increase it.
    // Prediction can support a calculated attack because the racer reads moving gaps earlier.
    risk += prediction*.025 - riskControl*.060;
    risk += (p.raceForm-1)*(.30+pressure*.08);

    // Situation-aware race management. This changes route risk only; there is no rubber-band speed boost.
    if(rs.rank===1){
      // Leaders protect a result, especially late. High Risk Control makes this effect stronger.
      risk-=.105 + Math.max(0,riskControl)*(.045+.055*progressRatio);
      if(progressRatio>.72) risk-=.025+Math.max(0,pressure)*.018;
    }else if(rs.rank===2){
      // P2 attacks a reachable leader late, but composed racers do not panic if the gap is large.
      if(progressRatio>.68 && rs.nearestAheadGap<6.2)
        risk+=.035 + Math.max(0,aggression)*.030 + Math.max(0,pressure)*.018;
    }else if(rs.rank>=3){
      const urgency=Math.max(0,(progressRatio-.55)/.45);
      risk+=urgency*(.025+Math.max(0,aggression)*.045+Math.max(0,pressure)*.025);
    }
    if(progressRatio>.88 && rs.rank>=3) risk+=.030+Math.max(0,pressure)*.022;
    risk=Math.max(0,Math.min(.52,risk));

    p.tacticalRisk=risk;
    p.tacticalRiskUntil=now+520+Math.random()*380;
    p.tacticalRiskCooldown=now+420+Math.random()*300;
    return risk;
  }

  function tacticalSituationOffset(p,si,now,baseOff){
    const risk=tacticalRiskLevel(p,now);
    if(risk<.08) return baseOff;

    if(now<p.situationDecisionUntil){
      return Math.abs(p.situationDecisionOffset)>.001
        ? baseOff*.34+p.situationDecisionOffset*.66
        : baseOff;
    }

    const rs=liveRaceSituation(p);
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.575);
    const inside=cornerInsideSide(si);
    const turn=cornerIntensity(si);
    const nearby=playerPerceivedObservers(p,12.5);
    let chosen=0;

    // v4.46 leader protection: when closely chased, prefer the already-stable racing line
    // instead of inventing a risky tactical lane change. Avoidance still has final authority.
    if(rs.state==="LEADER_DEFEND" && nearby.length>0){
      p.situationDecisionOffset=0;
      p.situationDecisionUntil=now+360+Math.max(0,(p.stats.riskControl-72)/27)*180;
      return baseOff;
    }

    if(nearby.length<=2 && rs.nearestAheadGap<4.9){
      let side=inside;
      if(side===0) side=(p.index%2?1:-1);
      const commit=Math.min(.96,.46+risk*.82+((p.stats.control-72)/27)*.08);
      if(Math.random()<Math.min(.26,risk*.16)) chosen=side*half*commit;
    }

    if(!chosen && rs.rank>=4 && rs.progress>routeLength*.62 && inside!==0 && turn>.045 && nearby.length===0){
      if(Math.random()<Math.min(.18,risk*.11)){
        const commit=Math.min(.995,.84+risk*.28);
        chosen=inside*half*commit;
      }
    }

    p.situationDecisionOffset=chosen;
    p.situationDecisionUntil=now+280+Math.random()*260;
    return chosen ? baseOff*.34+chosen*.66 : baseOff;
  }


  function tacticalVariantOffset(p,si,now,baseOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);

    if(now<p.variantUntil && p.variantMode){
      return Math.max(-half*.998,Math.min(half*.998,
        baseOff*(1-p.variantStrength)+p.variantSide*half*p.variantStrength));
    }

    if(p.variantMode && now>=p.variantUntil){
      p.variantMode=0;
      p.variantSide=0;
      p.variantStrength=0;
    }

    if(now<p.variantCooldown) return baseOff;

    // Never gamble into immediate observer danger.
    const nearby=playerPerceivedObservers(p,11.5);
    if(nearby.length>0){
      p.variantCooldown=now+1600+Math.random()*2200;
      return baseOff;
    }

    const inside=cornerInsideSide(si);
    const power=cornerIntensity(si);
    if(inside===0 || power<0.045){
      p.variantCooldown=now+1800+Math.random()*2600;
      return baseOff;
    }

    const aggression=(p.stats.aggression-72)/27;
    const insideSkill=(p.stats.insideLine-72)/27;
    const control=(p.stats.control-72)/27;
    const pressure=(p.stats.pressure-72)/27;

    // Very low probability tactical gamble: attack an extreme apex for a pass.
    const chance=.030 + aggression*.018 + insideSkill*.022 + pressure*.010;
    if(Math.random()<chance){
      p.variantMode=1;
      p.variantSide=inside;
      const identity=identityOf(p);
      p.variantStrength=Math.min(.995,(.88+insideSkill*.07+control*.025)*(identity.apex||1));
      p.variantUntil=now+520+Math.random()*620;
      p.variantCooldown=now+5200+Math.random()*6200;
      return baseOff*(1-p.variantStrength)+inside*half*p.variantStrength;
    }

    p.variantCooldown=now+2200+Math.random()*3000;
    return baseOff;
  }


  // v2.13: dedicated overtake/comeback planner.
  // It never gives a trailing racer extra base speed. It only changes line choice,
  // timing, and risk according to the next corner and observer layout.
  function racerLateralOffsetOnSeg(q,si){
    const s=segs[Math.min(si,segs.length-1)];
    return (q.x-s.a[0])*s.nx+(q.y-s.a[1])*s.ny;
  }

  function passTraffic65(p,si,myProg){
    const out=[];
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done || q.dead) continue;
      const prog=currentProgress(q);
      const gap=prog-myProg;
      if(gap>-.8 && gap<13.5){
        out.push({q,gap,off:racerLateralOffsetOnSeg(q,si),prog});
      }
    }
    out.sort((a,b)=>a.gap-b.gap);
    return out;
  }

  function passLaneScore65(p,si,off,traffic,baseLine){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    let score=Math.abs(off-baseLine)*.060;
    for(const t of traffic){
      if(t.gap<0) continue;
      const dg=Math.max(.18,t.gap);
      const lat=Math.abs(off-t.off);
      const longitudinal=Math.max(0,1-dg/10.5);
      const block=Math.max(0,1-lat/1.70);
      score+=block*longitudinal*4.8;
      if(dg<3.1 && lat<1.05) score+=(3.1-dg)*1.35;
    }
    const inside=cornerInsideSide(si);
    let future=0;
    for(let k=0;k<=3;k++){
      const sj=Math.min(segs.length-1,si+k);
      const c=cornerIntensity(sj);
      const side=cornerInsideSide(sj);
      if(side && c>.025){ future=side*Math.max(c,.06)*(1-k*.16); break; }
    }
    if(future){
      const cornerTarget=Math.sign(future)*half*.56;
      score+=Math.abs(off-cornerTarget)*Math.min(.16,.055+Math.abs(future)*.42);
    }
    return score;
  }

  // v4.65 OVERTAKE AI 1.0:
  // Read the actual racer ahead, compare open left/right lanes and the next 2-3
  // corners, then commit to a pass corridor. Racers remain non-solid; this is
  // tactical route choice, not collision physics or rubber-band speed.
  
  // v4.75-v4.79 INTEGRATED RACE AI
  // 4.75 chase 2.0 / 4.76 overtake 2.0 / 4.77 side-by-side 2.0
  // 4.78 rejoin 4.0 / 4.79 racing line 4.0.
  //
  // Fast-side calibration from actual map geometry:
  // 7->5 o'clock: upper corridor, 3->9 o'clock: upper corridor,
  // final 11->1 o'clock: lower corridor. Edge rows remain fully legal road.
  
function calibratedFastCorridor79(si){
    // v4.95: disabled.
    // The old calibration forcibly pulled long horizontal corridors toward a selected
    // screen-side edge. That is exactly what caused racers to leave an already-fast
    // horizontal line and make a pointless vertical move to the one-row edge.
    return null;
  }

  function raceLine79(p,si,baseOff,passActive=false){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const calibrated=calibratedFastCorridor79(idx);
    let target=baseOff;

    if(calibrated){
      // These long corridors have an obvious shortest screen-side line.
      // Normal racing strongly commits to it; a genuine pass may deviate modestly.
      const authority=passActive?.58:.94;
      target=target*(1-authority)+calibrated.off*authority;
    }

    // 4.79 global anti-exterior rule: outside of the calibrated corridors,
    // do not create a large lane excursion unless traffic really blocks the route.
    const macro=integratedFastLine74(p,idx,cornerPhysics64Target(
      p,idx,optimalRacingLine2Offset(p,idx)).off);
    const maxDev=half*(passActive?.52:.26);
    const d=target-macro;
    if(Math.abs(d)>maxDev && !calibrated){
      target=macro+Math.sign(d)*maxDev;
    }
    return clampRoadOffset(idx,target,p);
  }

  function chaseLine75(p,si,baseOff){
    const rs=liveRaceSituation(p);
    if(rs.rank<=1 || rs.nearestAheadGap>8.5) return baseOff;
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const fast=raceLine79(p,idx,baseOff,false);
    // Never copy a slower opponent's lane. A chaser follows the map's fast line.
    const urgency=Math.max(0,Math.min(1,(8.5-rs.nearestAheadGap)/8.5));
    const authority=.72+urgency*.20;
    return baseOff*(1-authority)+fast*authority;
  }

function overtakePlan(p,si,now){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);

    if(now<p.passPlanUntil && p.passPlanMode){
      const target=players[p.passTargetId];
      if(target && !target.done && !target.dead){
        const rel=currentProgress(target)-currentProgress(p);
        // Keep the move committed while side-by-side; once clearly ahead, release
        // quickly back toward the optimal racing line.
        if(rel>-.75) return {off:p.passPlanOffset,speedMul:p.passPlanSpeedMul,mode:p.passPlanMode};
      }
      p.passPlanUntil=Math.min(p.passPlanUntil,now+90);
    }
    if(p.passPlanMode && now>=p.passPlanUntil){
      p.passPlanMode=0;
      p.passTargetId=-1;
      p.passPlanSpeedMul=1;
    }
    if(now<p.passPlanCooldown) return null;

    const myProg=currentProgress(p);
    const traffic=passTraffic65(p,si,myProg);
    const ahead=traffic.filter(t=>t.gap>.12 && t.gap<9.6);
    if(!ahead.length){
      p.passPlanCooldown=now+260+Math.random()*240;
      return null;
    }

    // Prefer the racer that is both close and actually occupying our intended line.
    const baseLine=raceLine79(p,si,integratedFastLine74(p,si,cornerPhysics64Target(p,si,optimalRacingLine2Offset(p,si)).off),false);
    let chosen=null,bestTarget=1e9;
    for(const t of ahead){
      const laneOverlap=Math.abs(t.off-baseLine);
      const v=t.gap + Math.min(3.0,laneOverlap)*.72;
      if(v<bestTarget){ bestTarget=v; chosen=t; }
    }
    const target=chosen.q, gap=chosen.gap;

    const aggression=Math.max(0,Math.min(1,(p.stats.aggression-72)/27));
    const prediction=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    const routeRead=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const pressure=Math.max(0,Math.min(1,(p.stats.pressure-72)/27));
    const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const riskControl=Math.max(0,Math.min(1,(p.stats.riskControl-72)/27));
    const passSkill=Math.max(0,Math.min(1,
      aggression*.25+prediction*.22+routeRead*.22+control*.17+pressure*.14));

    // No artificial slow-path personality. Personality changes willingness and
    // commitment only after a genuinely useful pass lane has been found.
    const laneCandidates=[
      Math.max(-half*.96,Math.min(half*.96,baseLine)),
      -half*.56, half*.56, -half*.34, half*.34
    ];
    let bestOff=baseLine,bestScore=1e9;
    for(const off of laneCandidates){
      const score=passLaneScore65(p,si,off,traffic,baseLine);
      if(score<bestScore){bestScore=score;bestOff=off;}
    }
    const baseScore=passLaneScore65(p,si,baseLine,traffic,baseLine);
    const gain=baseScore-bestScore;
    const blocked=Math.abs(chosen.off-baseLine)<1.55 && gap<6.8;
    if(!blocked && gain<.32){
      p.passPlanCooldown=now+300+Math.random()*360;
      return null;
    }

    const corner=cornerIntensity(si);
    let futureCorner=corner, futureSide=cornerInsideSide(si);
    for(let k=1;k<=3;k++){
      const sj=Math.min(segs.length-1,si+k);
      const c=cornerIntensity(sj);
      if(c>futureCorner*.82){ futureCorner=c; futureSide=cornerInsideSide(sj)||futureSide; }
    }

    // Avoid choosing the same corridor as another racer already making the move.
    for(const t of traffic){
      const q=t.q;
      if(q.passPlanMode && q.passTargetId===target.index && Math.abs(q.passPlanOffset-bestOff)<1.15){
        const alt=-Math.sign(bestOff||1)*Math.min(half*.62,Math.max(half*.34,Math.abs(bestOff)));
        if(passLaneScore65(p,si,alt,traffic,baseLine)<=bestScore+.55) bestOff=alt;
      }
    }

    let mode=4; // straight / generic open-lane pass
    if(futureSide && Math.sign(bestOff)===futureSide && futureCorner>.045) mode=1; // inside attack
    else if(futureSide && Math.sign(bestOff)===-futureSide && futureCorner>.055) mode=2; // outside setup
    else if(gap<2.6 && Math.abs(chosen.off-bestOff)<1.25) mode=3; // patient cut

    // Stronger racers decide earlier, but nobody gets free acceleration.
    const need=Math.max(0,Math.min(1,(6.5-gap)/6.5));
    const useful=Math.max(0,Math.min(1,gain/2.4));
    const commitChance=Math.min(.96,.34+passSkill*.40+need*.14+useful*.16);
    if(Math.random()>commitChance){
      p.passPlanCooldown=now+300+(1-passSkill)*420+Math.random()*300;
      return null;
    }

    const commit=.78+passSkill*.17;
    bestOff=Math.max(-half*.97,Math.min(half*.97,bestOff*commit+baseLine*(1-commit)));
    let speedMul=1;
    if(mode===2) speedMul=.992;       // tiny setup cost, paid for better next-corner geometry
    else if(mode===3) speedMul=.985;  // timing move, never a large artificial brake
    else speedMul=.998;

    p.passPlanMode=mode;
    p.passPlanOffset=bestOff;
    p.passPlanSpeedMul=speedMul;
    p.passTargetId=target.index;
    p.passPlanUntil=now+(mode===2?650:mode===3?360:520)+Math.random()*260;
    p.passPlanCooldown=now+720+(1-passSkill)*620+Math.random()*600;
    if(p.match && p.match.passPlans){
      if(mode===1) p.match.passPlans.inside++;
      else if(mode===2) p.match.passPlans.outside++;
      else if(mode===3) p.match.passPlans.waitCut++;
      else p.match.passPlans.straight=(p.match.passPlans.straight||0)+1;
    }
    return {off:bestOff,speedMul,mode};
  }

  
  function multiCarTraffic66(p,si,myProg){
    const out=[];
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done || q.dead) continue;
      const gap=currentProgress(q)-myProg;
      if(gap>-2.4 && gap<12.8){
        out.push({q,gap,off:racerLateralOffsetOnSeg(q,si)});
      }
    }
    return out;
  }

  function multiCarCandidateScore66(p,si,off,traffic,soloLine){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    // Never abandon the fast line without a traffic benefit.
    let score=Math.abs(off-soloLine)*.135; // v4.69: stronger fast-line cost

    for(const t of traffic){
      const dg=Math.abs(t.gap);
      const lat=Math.abs(off-t.off);
      if(t.gap>=-.45){
        const longW=Math.max(0,1-Math.max(0,t.gap)/9.5);
        const laneW=Math.max(0,1-lat/1.62);
        score+=laneW*longW*4.25;
        if(Math.abs(t.gap)<1.45 && lat<1.05) score+=(1.45-Math.abs(t.gap))*.95+1.0;
      } else if(dg<1.5 && lat<1.0){
        // Side-by-side racer slightly behind: do not cut across their held corridor.
        score+=(1.5-dg)*.82;
      }
    }

    // Preserve 4.64 corner quality: among similarly open lanes, prefer the lane
    // that hands the car to the next 2-3 corners cleanly.
    let bestFutureSide=0,bestFuturePower=0;
    for(let k=0;k<=3;k++){
      const sj=Math.min(segs.length-1,si+k);
      const c=cornerIntensity(sj);
      const side=cornerInsideSide(sj);
      const weighted=c*(1-k*.15);
      if(side && weighted>bestFuturePower){
        bestFuturePower=weighted;
        bestFutureSide=side;
      }
    }
    if(bestFutureSide && bestFuturePower>.025){
      const useful=bestFutureSide*half*Math.min(.88,.60+bestFuturePower*1.6);
      score+=Math.abs(off-useful)*Math.min(.13,.035+bestFuturePower*.38);
    }
    return score;
  }

  // v4.66 MULTI-CAR RACING LINE 2.0
  // Solo/leader: keep the globally optimal 4.64 line.
  // Chaser/pack: only leave it when another racer really occupies the useful corridor.
  // Side-by-side: hold distinct corridors briefly instead of repeatedly crossing.
  // Racers are still non-solid; there is no push, contact slowdown or rubber-banding.
  function multiCarRacingLine66(p,si,now,soloLine){
    if(now<p.multiCarLineUntil && p.multiCarLineMode!=="solo"){
      return {off:p.multiCarLineOffset,mode:p.multiCarLineMode,authority:.76};
    }

    const myProg=currentProgress(p);
    const traffic=multiCarTraffic66(p,si,myProg);
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    if(!traffic.length){
      p.multiCarLineMode="solo";
      p.multiCarLineOffset=soloLine;
      p.multiCarLineUntil=now+180;
      return {off:soloLine,mode:"solo",authority:0};
    }

    const ahead=traffic.filter(t=>t.gap>.10);
    const sideBySide=traffic.filter(t=>Math.abs(t.gap)<=1.35);
    const optimalBlocked=ahead.some(t=>t.gap<6.8 && Math.abs(t.off-soloLine)<1.45);

    // Leading/open-air cars must not weave simply because somebody exists behind.
    if(!optimalBlocked && sideBySide.length===0){
      p.multiCarLineMode="leader";
      p.multiCarLineOffset=soloLine;
      p.multiCarLineUntil=now+200;
      return {off:soloLine,mode:"leader",authority:0};
    }

    const candidates=[
      Math.max(-half*.97,Math.min(half*.97,soloLine)),
      -half*.56, half*.56,
      -half*.38, half*.38,
      -half*.20, half*.20
    ];
    let bestOff=soloLine;
    let bestScore=multiCarCandidateScore66(p,si,soloLine,traffic,soloLine);
    const baseScore=bestScore;
    for(const off of candidates){
      const score=multiCarCandidateScore66(p,si,off,traffic,soloLine);
      if(score<bestScore){bestScore=score;bestOff=off;}
    }

    // No deliberately slow personality routes: if leaving the solo line does not
    // materially solve traffic, remain on the fast line.
    const trafficGain=baseScore-bestScore;
    if(trafficGain<.24 && !sideBySide.length){
      p.multiCarLineMode="leader";
      p.multiCarLineOffset=soloLine;
      p.multiCarLineUntil=now+190;
      return {off:soloLine,mode:"leader",authority:0};
    }

    let mode=sideBySide.length?"side-by-side":"pack";
    if(optimalBlocked && !sideBySide.length) mode="chaser";

    // If parallel with somebody, prefer staying on the side already occupied by p
    // unless that lane is clearly worse. This stops left-right lane swapping.
    if(sideBySide.length){
      const myOff=racerLateralOffsetOnSeg(p,si);
      const sameSideCandidates=candidates.filter(x=>Math.sign(x||myOff||1)===Math.sign(myOff||1));
      let holdOff=bestOff,holdScore=bestScore;
      for(const off of sameSideCandidates){
        const score=multiCarCandidateScore66(p,si,off,traffic,soloLine);
        if(score<=holdScore+.34){holdScore=score;holdOff=off;}
      }
      bestOff=holdOff;
    }

    const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const authority=Math.min(.90,.66+read*.11+control*.08+(sideBySide.length?.05:0));

    p.multiCarLineMode=mode;
    p.multiCarLineOffset=bestOff;
    p.multiCarLineUntil=now+(sideBySide.length?560:300)+Math.random()*150;
    return {off:bestOff,mode,authority};
  }

function packContextOffset(p,si,now){
    const s=segs[Math.min(si,segs.length-1)];
    const half=Math.max(1.8,widths[si]*0.56);

    if(now<p.packPlanUntil) return p.packPlanOffset;

    const myProg=currentProgress(p);
    let nearestAhead=null, nearestGap=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const gap=currentProgress(q)-myProg;
      if(gap>0 && gap<12.5 && gap<nearestGap){
        nearestAhead=q;
        nearestGap=gap;
      }
    }

    if(!nearestAhead){
      p.packPlanOffset=0;
      p.packPlanUntil=now+300;
      return 0;
    }

    const q=nearestAhead;
    const qOff=((q.x-s.a[0])*s.nx+(q.y-s.a[1])*s.ny);
    const myOff=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const aggression=(p.stats.aggression-72)/27;
    const pressure=(p.stats.pressure-72)/27;
    const control=(p.stats.control-72)/27;
    const inside=cornerInsideSide(si);

    // Players are non-solid. This is only a tactical passing-line choice:
    // racers may still overlap completely with no push, collision, or slowdown.
    let side=(qOff>=myOff)?-1:1;
    if(inside!==0 && Math.abs(qOff-inside*half)>half*.34 &&
       (p.drivingStyle.style==="opportunist" || p.drivingStyle.style==="attacker" || aggression>.62)){
      side=inside;
    }

    let commitment=.40;
    if(p.drivingStyle.style==="safeReader" || p.drivingStyle.style==="patient") commitment=.32;
    else if(p.drivingStyle.style==="attacker" || p.drivingStyle.style==="opportunist") commitment=.69;
    else if(p.drivingStyle.style==="controller") commitment=.46;

    commitment*=identityOf(p).commit;
    commitment+=aggression*.09+pressure*.06+control*.035;
    if(nearestGap<3.2) commitment+=.12;
    if(nearestGap<1.35) commitment+=.06;

    p.packPlanOffset=side*half*Math.min(.90,commitment);
    p.packPlanUntil=now+(nearestGap<2.25?250:340)+Math.random()*130;
    return p.packPlanOffset;
  }

  // v2.27: read the current corner together with the next meaningful corner.
  // This builds approach -> apex -> exit/preparation behavior instead of treating
  // every segment as an isolated turn.
  function racingCornerSequence(si){
    const cur=Math.min(si,segs.length-1);
    let currentSide=cornerInsideSide(cur);
    let currentPower=cornerIntensity(cur);
    let nextSide=0,nextPower=0,nextIndex=-1;

    for(let j=cur+1;j<Math.min(segs.length-1,cur+6);j++){
      const side=cornerInsideSide(j);
      const power=cornerIntensity(j);
      if(side!==0 && power>.035){
        nextSide=side;
        nextPower=power;
        nextIndex=j;
        break;
      }
    }
    return {currentSide,currentPower,nextSide,nextPower,nextIndex};
  }

  function cornerPhaseTarget(p,si,half){
    const seq=racingCornerSequence(si);
    const s=segs[si];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L>0?along/s.L:1;
    const insideSkill=(p.stats.insideLine-72)/27;
    const cornerSkill=(p.stats.cornering-72)/27;
    const routeRead=(p.stats.routeReading-72)/27;
    const precision=Math.max(0,Math.min(1,(insideSkill+cornerSkill+routeRead)/3));
    const confidence=Math.max(0,Math.min(1,p.cleanConfidence||0));

    // v4.14 shortest-line racing: do NOT use the classic outside-entry -> apex pattern.
    // Racers progressively attach to the inside before the bend, skim the inside
    // through it, then release smoothly. This is derived only from route curvature;
    // there are no hand-coded corner coordinates.
    if(seq.currentSide===0 && seq.nextSide!==0){
      const approach=seq.nextSide*half*(.68+.28*precision);
      return {target:approach,weight:.54+.24*routeRead,seq};
    }

    if(seq.currentSide!==0){
      if(phase<.24){
        const earlyInside=seq.currentSide*half*(.71+.26*precision);
        return {target:earlyInside,weight:.58+.22*cornerSkill,seq};
      }
      if(phase<.76){
        const apex=seq.currentSide*half*Math.min(.998,.935+.058*precision+.012*confidence);
        return {target:apex,weight:.72+.22*precision,seq};
      }
      if(seq.nextSide!==0){
        const release=seq.nextSide*half*(.62+.31*routeRead);
        return {target:release,weight:.50+.24*routeRead,seq};
      }
      const exit=seq.currentSide*half*(.58+.22*precision);
      return {target:exit,weight:.42+.18*precision,seq};
    }
    return {target:0,weight:0,seq};
  }


  function preCornerPositionTarget(p,si,now,baseOff){
    const s=segs[Math.min(si,segs.length-1)];
    let nextSide=0,nextIndex=-1;
    for(let j=si+1;j<Math.min(segs.length,si+9);j++){
      const side=cornerInsideSide(j);
      if(side!==0){nextSide=side;nextIndex=j;break;}
    }
    if(nextIndex<0 || nextSide===0) return baseOff;
    const distanceSeg=nextIndex-si;
    if(distanceSeg>5) return baseOff;
    const read=(p.stats.routeReading-72)/27;
    const corner=(p.stats.cornering-72)/27;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.56);
    // v4.14: shortest-path preparation. Move toward the UPCOMING INSIDE early
    // instead of swinging to the outside and making a large right-angle arc.
    const inside=(p.stats.insideLine-72)/27;
    const setup=nextSide*half*(.60+.30*read+.10*inside);
    const weight=Math.max(.22,Math.min(.76,(6-distanceSeg)*.095+.17*read+.10*corner+.08*inside));
    if(now<p.preCornerUntil) return baseOff*.42+p.preCornerOffset*.58;
    p.preCornerOffset=setup;
    p.preCornerUntil=now+380+read*180;
    return baseOff*(1-weight)+setup*weight;
  }

  function linkedCornerTarget(p,si,baseOff){
    const seq=racingCornerSequence(si);
    if(seq.currentSide===0 || seq.nextSide===0 || seq.nextIndex<0) return baseOff;
    const s=segs[Math.min(si,segs.length-1)];
    const along=Math.max(0,Math.min(s.L,(p.x-s.a[0])*s.ux+(p.y-s.a[1])*s.uy));
    const phase=s.L?along/s.L:1;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
    const read=(p.stats.routeReading-72)/27;
    const corner=(p.stats.cornering-72)/27;
    const inside=(p.stats.insideLine-72)/27;
    const skill=Math.max(0,Math.min(1,(read+corner+inside)/3));
    if(seq.currentSide===seq.nextSide){
      const linked=seq.currentSide*half*Math.min(.997,.91+skill*.075);
      const w=phase>.45 ? (.34+.28*skill) : (.16+.15*skill);
      return baseOff*(1-w)+linked*w;
    }
    if(phase>.54){
      const prep=seq.nextSide*half*(.62+.30*skill);
      const w=Math.min(.62,.24+(phase-.54)*.72+.18*skill);
      return baseOff*(1-w)+prep*w;
    }
    return baseOff;
  }

  // v4.49 CORNER / INSIDE-LINE FINALIZER:
  // Build one continuous entry -> apex -> exit decision from route geometry.
  // High Cornering / Inside Line / Route Reading racers commit earlier and closer
  // to the legal inside edge. The next corner is considered before the current
  // corner ends, so S-bends connect without a centre-line snap. Observer avoidance
  // is applied later and always retains final authority.
  function precisionCornerTarget(p,si,now,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const half=Math.max(1.8,widths[Math.min(idx,widths.length-1)]*.565);
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const skill=Math.max(0,Math.min(1,insideN*.34+cornerN*.31+readN*.23+controlN*.12));
    const seq=racingCornerSequence(idx);
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L>0?along/s.L:1;

    // If the current segment is straight, prepare for the first meaningful turn.
    if(seq.currentSide===0 && seq.nextSide!==0){
      const gap=Math.max(1,(seq.nextIndex-idx));
      const proximity=Math.max(0,1-Math.min(1,(gap-1)/5));
      const commit=.58+.26*skill+.10*proximity;
      const target=seq.nextSide*half*Math.min(.965,commit);
      const w=.28+.28*readN+.14*cornerN+.12*proximity;
      return baseOff*(1-Math.min(.76,w))+target*Math.min(.76,w);
    }

    if(seq.currentSide===0) return baseOff;

    // Through the bend, progressively tighten to the apex. Good racers reach it
    // earlier, hold it more accurately, then release toward the next optimal line.
    let target=baseOff, weight=0;
    if(phase<.22){
      const entry=.70+.21*skill;
      target=seq.currentSide*half*Math.min(.955,entry);
      weight=.42+.28*cornerN+.12*readN;
    }else if(phase<.72){
      const apex=.925+.067*skill+(identityOf(p).apex-1)*.045;
      target=seq.currentSide*half*Math.min(.997,Math.max(.86,apex));
      weight=.64+.25*skill;
    }else if(seq.nextSide!==0){
      if(seq.nextSide===seq.currentSide){
        // Same-direction linked corners: stay attached to the inside rather than
        // unnecessarily opening the steering between bends.
        target=seq.currentSide*half*Math.min(.995,.89+.09*skill);
        weight=.52+.27*readN;
      }else{
        // Opposite-direction linked corners: cross the road smoothly only as much
        // as necessary to set up the following apex.
        const release=(phase-.72)/.28;
        const nextCommit=.54+.34*readN+.08*cornerN;
        const next=seq.nextSide*half*Math.min(.93,nextCommit);
        const current=seq.currentSide*half*(.64+.20*skill);
        target=current*(1-release)+next*release;
        weight=.46+.28*readN+.10*controlN;
      }
    }else{
      const exit=.54+.22*cornerN+.10*controlN;
      target=seq.currentSide*half*Math.min(.88,exit);
      weight=.36+.22*cornerN;
    }

    // Nearby observers do not disable corner skill, but they reduce racing-line
    // stubbornness so the later avoidance planner can take over cleanly.
    const obs=playerPerceivedObservers(p,10.5).length;
    if(obs>0) weight*=obs>=3?.48:.68;
    weight=Math.max(0,Math.min(.91,weight));
    return baseOff*(1-weight)+target*weight;
  }

  function creativeRouteAdjustment(p,si,now,baseOff){
    const progress=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const danger=playerPerceivedObservers(p,18).length, lp=p.linePersonality||0;
    // v4.68: on clear road, creativity means execution style, not a slower/wider route.
    if(danger===0) return baseOff;
    // Dense fields temporarily raise the creative-route allowance and reduce
    // the trigger threshold. Normal sections remain close to the v2.41 70/30 mix.
    const denseBoost=danger>=8?.16:danger>=5?.11:danger>=3?.055:0;
    const targetCreative=progress*Math.min(.68,p.creativeRouteBudget+denseBoost);
    const triggerSlack=danger>=5?.040:.018;
    if(now>=p.creativeModeUntil && now>=p.creativeCooldown && p.creativeRouteUsed+triggerSlack<targetCreative){
      const roll=Math.random();
      if(danger>=8) p.creativeMode=roll<.28?1:roll<.54?2:roll<.76?3:roll<.88?4:5;
      else if(danger>=5) p.creativeMode=roll<.22?1:roll<.48?2:roll<.72?3:roll<.85?4:5;
      else if(lp>.45) p.creativeMode=roll<.52?1:roll<.73?5:roll<.90?3:2;
      else if(lp<-.45) p.creativeMode=roll<.55?2:roll<.78?4:roll<.92?3:5;
      else p.creativeMode=roll<.25?1:roll<.50?2:roll<.72?3:roll<.84?4:5;
      p.creativeSide=Math.random()<.5?-1:1;
      const dense=danger>=5;
      p.creativeModeUntil=now+(dense?760:900)+Math.random()*(dense?1400:1700);
      p.creativeCooldown=now+(dense?650:1150)+Math.random()*(dense?1000:1550);
    }
    if(now<p.creativeModeUntil){
      p.creativeRouteUsed=Math.min(.55,p.creativeRouteUsed+(danger>=5?.00265:.00215));
      const inside=cornerInsideSide(si);
      if(p.creativeMode===1){
        // WALL APEX: on a real corner, hug the legal road edge as tightly as possible.
        // This is route choice only; observer avoidance can still override downstream.
        return inside ? inside*half*.999 : baseOff*.48+p.creativeSide*half*.30;
      }
      if(p.creativeMode===2) return (inside?-inside:p.creativeSide)*half*(danger>=8?.96:danger>=5?.92:.72);
      if(p.creativeMode===3){
        const amp=half*(danger>=8?.70:danger>=5?.64:.38);
        return Math.max(-half*.90,Math.min(half*.90,baseOff+Math.sin(now*.010+p.creativePhase)*amp));
      }
      if(p.creativeMode===4){
        // v2.51: old creative stop is replaced by a moving escape.
        if(danger>=3 && p.controlMode==="normal" && now>=p.controlCooldown){
          beginControl(p,Math.random()<.55?"diagonal":"zigzag",now,240+Math.random()*190,true,-1);
          p.controlCooldown=now+1200+Math.random()*1100;
        }
        return baseOff*.88;
      }
      if(p.creativeMode===5){
        const phase=Math.max(0,Math.min(1,1-(p.creativeModeUntil-now)/1500));
        const side=inside||p.creativeSide;
        return side*half*(phase<.48?-.50:.72);
      }
    }
    return baseOff;
  }

  function plannedRacingOffset(p,si,now){
    // Re-plan only a few times per second. This prevents rapid left/right
    // oscillation when racers overlap while still reacting early to corners.
    if(now < p.linePlanUntil) return p.linePlanOffset;

    const s=segs[si];
    const lineSkill=(p.stats.cornering+p.stats.insideLine+p.stats.routeReading)/3;
    const lineNorm=(lineSkill-72)/27;
    const half=Math.max(1.8,widths[si]*(1.015+lineNorm*0.050));

    // v31: when the local road is genuinely clear of observers, commit to a
    // near-wall Kart-style apex instead of wasting space in the middle.
    const cornerSide=cornerInsideSide(si);
    const cornerPower=cornerIntensity(si);
    const localObs=playerPerceivedObservers(p,18.0);
    if(localObs.length===0 && cornerSide!==0 && cornerPower>0.055){
      // v2.60: even on a clear road, use a true outside-entry/apex/exit sequence.
      const phasePlan=cornerPhaseTarget(p,si,half);
      const lp=p.linePersonality||0;
      const skill=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/3;
      const skillN=(skill-72)/27;
      const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
      const apexCommit=Math.max(.965,Math.min(1.035,.995+lp*.026+skillN*.020+insideN*.022+(p.cleanConfidence||0)*.012));
      let archetypeMul=1.0;
      const arch=p.routeArchetype||"adaptive";
      if(arch==="extremeInside") archetypeMul=1.075;
      else if(arch==="inside") archetypeMul=1.025;
      else if(arch==="wideCut") archetypeMul=.72;
      else if(arch==="variant") archetypeMul=.84+Math.sin(si*.71+(p.routeBandPhase||0))*.16;
      const apex=cornerSide*half*apexCommit*archetypeMul;
      const phaseBlend=Math.max(.30,Math.min(.82,phasePlan.weight+.14));
      p.linePlanOffset=apex*(1-phaseBlend)+phasePlan.target*phaseBlend;
      p.linePlanUntil=now+280+Math.random()*90;
      return p.linePlanOffset;
    }

    const candidates=[-0.999,-0.91,-0.76,-0.58,-0.34,0,0.34,0.58,0.76,0.91,0.999];
    const phasePlan=cornerPhaseTarget(p,si,half);
    let bestOff=0;
    let bestScore=Infinity;

    const routeRead=(p.stats.routeReading-72)/27;
    const maxAhead=Math.min(segs.length-1,si+5+Math.round(routeRead*3));
    for(const c of candidates){
      const off=c*half;
      let px=p.x, py=p.y;
      let score=0;

      // Cost of getting from the current position onto this candidate line.
      const entryX=s.b[0]+s.nx*off;
      const entryY=s.b[1]+s.ny*off;
      const edx=entryX-px, edy=entryY-py; score += Math.sqrt(edx*edx+edy*edy);
      px=entryX; py=entryY;

      // Look through several future segments and compare total path length.
      // Candidate offsets progressively prepare for the next apex.
      for(let j=si+1;j<=maxAhead;j++){
        const seg=segs[j];
        const prev=segs[Math.max(si,j-1)];
        const next=segs[Math.min(segs.length-1,j+1)];
        const turn=prev.ux*next.uy-prev.uy*next.ux;
        const h=Math.max(1.6,widths[j]*0.635);

        let futureOff=off*(0.56-routeRead*.09);
        if(Math.abs(turn)>0.025){
          const inside=(turn>0 ? 1 : -1);
          const apexCommit=0.91+routeRead*.085+((p.stats.insideLine-72)/27)*.105;
          const nextApex=inside*h*Math.min(.997,apexCommit);
          const prep=0.66+routeRead*.24;
          futureOff=futureOff*(1-prep)+nextApex*prep;

          // Read one more corner: if the following corner turns the other way,
          // reward an exit that naturally sets up the next entry.
          if(j<maxAhead){
            const nn=segs[Math.min(segs.length-1,j+2)];
            const nextTurn=next.ux*nn.uy-next.uy*nn.ux;
            if(Math.abs(nextTurn)>.025){
              const nextInside=nextTurn>0?1:-1;
              const transition=-nextInside*h*(.22+routeRead*.18);
              futureOff=futureOff*.78+transition*.22;
            }
          }
        }

        const wx=seg.b[0]+seg.nx*futureOff;
        const wy=seg.b[1]+seg.ny*futureOff;
        score += Math.hypot(wx-px,wy-py);
        px=wx; py=wy;
      }

      // v4.04: no forced opening wall route. Start lanes remain genuinely diverse;
      // stats/personality decide whether to use upper, middle, or lower legal bands.

      // v2.27 corner phase: reward a realistic outside-entry -> apex -> exit setup.
      if(phasePlan.weight>0){
        const phaseDist=Math.abs(off-phasePlan.target)/Math.max(1,half);
        score += phaseDist*(.44+phasePlan.weight*.72);
      }

      // v2.34 persistent route personality:
      // inside specialists prefer the corner's inside candidate; safety racers pay
      // extra cost near either edge and therefore keep a visibly wider/smoother route.
      const lp=p.linePersonality||0;
      if(cornerSide!==0 && cornerPower>.035){
        const insideCandidate=c*cornerSide;
        if(lp>0) score-=Math.max(0,insideCandidate)*lp*.46;
        else score+=Math.abs(c)*(-lp)*.52;
      }else if(lp<0){
        score+=Math.abs(c)*(-lp)*.18;
      }

      // v4.02 PERSONAL ROUTE DIVERSITY:
      // Do not make all racers collapse onto the same mathematical optimum.
      // Route-reading controls how strongly a racer trusts the optimal line;
      // individual stats/style create a persistent legal lane preference.
      // On corners the preference blends with the real inside/outside phase rather
      // than fighting it, and any observer avoidance later overrides this planner.
      const readTrust=(p.stats.routeReading-72)/27;
      const controlTrust=((p.stats.control+p.stats.consistency)/2-72)/27;
      const safetyBias=((p.stats.riskControl+p.stats.stability)/2-72)/27;
      const routeVar=Math.max(.26,Math.min(.82,.66-readTrust*.15-controlTrust*.04+safetyBias*.05));
      let personalTarget=(p.routeBand||0);
      const archetype=p.routeArchetype||"adaptive", archetypeStrength=p.routeArchetypeStrength||.8;
      if(cornerSide!==0 && cornerPower>.035){
        const insideTalent=(p.stats.insideLine-72)/27;
        const cornerTalent=(p.stats.cornering-72)/27;
        let archetypeTarget=cornerSide*(.72+insideTalent*.25);
        if(archetype==="extremeInside") archetypeTarget=cornerSide*(1.08+insideTalent*.08);
        else if(archetype==="inside") archetypeTarget=cornerSide*(.92+insideTalent*.08);
        else if(archetype==="wideCut") archetypeTarget=-cornerSide*(.34+Math.max(0,safetyBias)*.18);
        else if(archetype==="variant") archetypeTarget=cornerSide*(.42+Math.sin(si*.73+(p.routeBandPhase||0))*.42);
        const cornerBlend=Math.max(.30,Math.min(.88,.42+insideTalent*.18+cornerTalent*.12+archetypeStrength*.12));
        personalTarget=personalTarget*(1-cornerBlend)+archetypeTarget*cornerBlend;
      }else{
        const wave=archetype==="variant"?.42:archetype==="wideCut"?.30:.24;
        personalTarget+=Math.sin((si*.38)+(p.routeBandPhase||0))*wave*archetypeStrength;
        if(archetype==="extremeInside") personalTarget*=1.12;
      }
      personalTarget=Math.max(-1.16,Math.min(1.16,personalTarget));
      const personalDist=Math.abs(c-personalTarget);
      score += personalDist*routeVar*(1.45+archetypeStrength*.45);

      // v4.06 DEATH-EDGE AWARENESS: no wall exists. Two outer rows are survivable,
      // but racers understand the third row is lethal. Extreme inside specialists can
      // exploit the survivable margin while normal lines keep a safer buffer.
      const legalRatio=Math.abs(off)/Math.max(1,half);
      const edgeRisk=Math.max(0,legalRatio-.91);
      const insideN=(p.stats.insideLine-72)/27;
      const controlN=(p.stats.control-72)/27;
      score += edgeRisk*edgeRisk*(.42-insideN*.16-controlN*.10);

      // Avoid wall scraping while still allowing near-apex lines.
      // Skilled racers pay a smaller penalty and can exploit millimetre-like edge gains.
      const edgeSkill=((p.stats.cornering+p.stats.insideLine+p.stats.control)/3-72)/27;
      score += Math.pow(Math.abs(c),5)*.015; // v4.03: no wall-scrape penalty for air units

      // v29: cornering/inside-line/route-reading and personality determine
      // how aggressively the racer trusts the shortest apex.
      const skill=(lineSkill-72)/27;
      const risk=(p.stats.riskControl-72)/27;
      const attack=p.drivingStyle.attack;
      score *= (1.045-skill*0.050);
      score += Math.abs(c)*Math.max(0,1-risk)*0.22/attack;

      if(score<bestScore){
        bestScore=score;
        bestOff=off;
      }
    }

    p.linePlanOffset=bestOff;
    p.linePlanUntil=now+245+Math.random()*115;
    return bestOff;
  }



  // v4.64 CORNERING PHYSICS 2.0 + OPTIMAL RACING LINE 2.1
  // The map-wide solver now models corner entry, apex and exit separately. It
  // classifies bend severity, rewards outside -> inside -> outside geometry, and
  // looks through linked corners so the exit of one bend becomes the entry of the next.
  let racingLine2Cache=null;
  function cornerClass64(si){
    const power=cornerIntensity(si);
    if(power>=.30) return {name:"hairpin",power,entry:.96,apex:.995,exit:.88,speed:.936};
    if(power>=.205) return {name:"sharp",power,entry:.90,apex:.992,exit:.82,speed:.958};
    if(power>=.125) return {name:"medium",power,entry:.80,apex:.982,exit:.74,speed:.978};
    if(power>=.055) return {name:"sweeper",power,entry:.65,apex:.945,exit:.62,speed:.992};
    return {name:"straight",power,entry:0,apex:0,exit:0,speed:1};
  }

  function nextMeaningfulCorner64(si,maxLook=5){
    for(let k=1;k<=maxLook;k++){
      const idx=Math.min(route.length-2,si+k);
      const side=cornerInsideSide(idx), cls=cornerClass64(idx);
      if(side && cls.power>=.055) return {idx,side,cls,gap:k};
    }
    return null;
  }

  function buildOptimalRacingLine2(){
    if(racingLine2Cache) return racingLine2Cache;
    const fracs=[-.985,-.90,-.81,-.72,-.63,-.54,-.45,-.36,-.27,-.18,-.09,0,.09,.18,.27,.36,.45,.54,.63,.72,.81,.90,.985];
    const K=fracs.length,N=segs.length;
    const nodes=Array.from({length:N},(_,i)=>{
      const s=segs[i],half=Math.max(2.0,widths[i]*ROAD_MARGIN*.972);
      return fracs.map(f=>({off:f*half,x:s.b[0]+s.nx*f*half,y:s.b[1]+s.ny*f*half,frac:f}));
    });
    const INF=1e30;
    let dp=Array.from({length:K},()=>Array(K).fill(INF));
    const back=Array.from({length:N},()=>Array.from({length:K},()=>Array(K).fill(-1)));
    const start={x:route[0][0],y:route[0][1]};
    for(let b=0;b<K;b++){
      const q=nodes[0][b];
      if(!lineStaysOnCourse(start.x,start.y,q.x,q.y,ROUTE_PLAN_EXTRA*.72)) continue;
      const d=Math.hypot(q.x-start.x,q.y-start.y);
      const nc=nextMeaningfulCorner64(0,5);
      // v4.94: shortest-path game — no outside-entry reward on a clear straight.
      // Future corners may affect steering later, but never justify a slower dogleg now.
      const entryBonus=0;
      dp[b][b]=d+entryBonus;
    }
    for(let i=1;i<N;i++){
      const ndp=Array.from({length:K},()=>Array(K).fill(INF));
      for(let a=0;a<K;a++) for(let b=0;b<K;b++){
        const base=dp[a][b]; if(base>=INF) continue;
        const prev=i===1?start:nodes[i-2][a];
        const cur=nodes[i-1][b];
        const v1x=cur.x-prev.x,v1y=cur.y-prev.y;
        const l1=Math.hypot(v1x,v1y)||1;
        for(let c=0;c<K;c++){
          const nxt=nodes[i][c];
          if(!lineStaysOnCourse(cur.x,cur.y,nxt.x,nxt.y,ROUTE_PLAN_EXTRA*.72)) continue;
          const v2x=nxt.x-cur.x,v2y=nxt.y-cur.y;
          const l2=Math.hypot(v2x,v2y)||1;
          const dot=Math.max(-1,Math.min(1,(v1x*v2x+v1y*v2y)/(l1*l2)));
          const ang=Math.acos(dot);
          const cls=cornerClass64(i), side=cornerInsideSide(i);
          // Steering loss grows superlinearly in sharper bends. Abrupt zig-zags are
          // expensive, while a long smooth arc can beat the raw shortest chord.
          let cost=base+l2+ang*ang*(4.25+cls.power*7.8);
          if(side && cls.power>=.055){
            // v4.94: never reward an outside/dogleg entry. Reward only a useful
            // inside apex; the route solver should minimize geometric path length first.
            cost += -side*nxt.frac*cls.power*(.42+.48*cls.apex);
          }
          const future=nextMeaningfulCorner64(i,3);
          if(future){
            // Exit toward the outside of the current bend unless a close linked
            // corner needs the opposite side. For S-bends, that same exit naturally
            // becomes the outside entry of the following corner.
            const w=future.cls.power*(future.gap===1?.10:future.gap===2?.055:.025); // v4.94 minimal anticipation
            cost += future.side*nxt.frac*w;
          }
          // Wide straights should not default to centre. Lane changes are penalized
          // only when they add distance without preparing a meaningful bend.
          if(cls.power<.055) cost += Math.abs(nxt.frac-cur.frac)*.34; // v4.94 straight-line discipline
          if(cost<ndp[b][c]){ndp[b][c]=cost;back[i][b][c]=a;}
        }
      }
      dp=ndp;
    }
    let ba=0,bb=0,best=INF;
    for(let a=0;a<K;a++) for(let b=0;b<K;b++) if(dp[a][b]<best){best=dp[a][b];ba=a;bb=b;}
    const chosen=Array(N).fill(0);
    if(N===1){chosen[0]=bb;}
    else{
      chosen[N-2]=ba; chosen[N-1]=bb;
      for(let i=N-1;i>=2;i--){
        const a=back[i][chosen[i-1]][chosen[i]];
        chosen[i-2]=a<0?Math.floor(K/2):a;
      }
    }
    racingLine2Cache=chosen.map((k,i)=>nodes[i][k].off);
    return racingLine2Cache;
  }

  function optimalRacingLine2Offset(p,si){
    const line=buildOptimalRacingLine2();
    si=Math.max(0,Math.min(line.length-1,si));
    const base=line[si]||0;
    // Individuality remains execution quality around the same fast macro line.
    const skill=Math.max(0,Math.min(1,((p.stats.cornering+p.stats.insideLine+p.stats.routeReading+p.stats.control)/4-72)/27));
    const half=Math.max(1.8,widths[si]*ROAD_MARGIN);
    const signature=Math.sin((si+1)*.61+(p.routeIdentityPhase||0))*half*(.003+(1-skill)*.008);
    return clampRoadOffset(si,base+signature,p);
  }

  function cornerPhysics64Target(p,si,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const cls=cornerClass64(idx), side=cornerInsideSide(idx);
    const rx=p.x-s.a[0],ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const phase=s.L?along/s.L:1;
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const cornerN=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const insideN=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const readN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const brakingN=Math.max(0,Math.min(1,(p.stats.braking-72)/27));
    const skill=cornerN*.32+insideN*.28+readN*.20+controlN*.14+brakingN*.06;
    let target=baseOff,weight=0,speedMul=1;

    // v4.68 SHORTEST-INSIDE CORNERING:
    // This game rewards path length, not car-tyre realism. Do not swing outside first.
    // Attach to the legal inside edge early, skim it through the bend, and only release
    // as much as the next route geometry actually requires.
    if(side && cls.power>=.035){
      const edgeCommit=Math.min(.998,.925+insideN*.050+cornerN*.018);
      const insideEdge=side*half*edgeCommit;
      if(phase<.22){
        // Early entry: already move strongly toward the inside instead of opening wide.
        const t=phase/.22;
        const early=side*half*(.76+insideN*.17+readN*.04);
        target=baseOff*(1-t)+early*t;
        weight=.78+cls.power*.40;
      }else if(phase<.82){
        // Hold the shortest legal arc for most of the corner.
        target=insideEdge;
        weight=.88+Math.min(.10,cls.power*.22);
      }else{
        const future=nextMeaningfulCorner64(idx,3);
        if(future && future.side!==side){
          // S-bend: cross only when the next inside line actually becomes useful.
          const t=(phase-.82)/.18;
          const nextInside=future.side*half*(.70+readN*.20);
          target=insideEdge*(1-t*.46)+nextInside*(t*.46);
          weight=.82;
        }else{
          // Same-direction / clear exit: keep hugging inside; no decorative outside exit.
          target=insideEdge;
          weight=.90;
        }
      }

      const minSpeed=cls.speed;
      const skillSave=(1-minSpeed)*Math.min(.92,skill*.78+cornerN*.14);
      speedMul=Math.min(1,minSpeed+skillSave);
      const apexLoad=Math.max(0,1-Math.abs(phase-.52)/.52);
      speedMul=1-(1-speedMul)*apexLoad;
    }else{
      // Straight: if a meaningful bend is coming soon, prepare on its INSIDE side early.
      const future=nextMeaningfulCorner64(idx,4);
      if(future){
        const proximity=Math.max(0,1-(future.gap-1)/4);
        const earlyInside=future.side*half*(.72+insideN*.14+readN*.08);
        const w=Math.min(.88,(.30+.50*proximity)*(.86+.14*readN));
        target=baseOff*(1-w)+earlyInside*w;
        weight=.92;
      }
    }
    return {off:clampRoadOffset(idx,baseOff*(1-Math.min(.98,weight))+target*Math.min(.98,weight),p),speedMul,type:cls.name};
  }

  function extremeInsideAdjustment(p,si,now,baseOff){
    // v4.63: on an observer-free road, never invent a risky/slow personality route.
    if(playerPerceivedObservers(p,18.0).length===0){
      p.extremeInsideActive=false; p.extremeInsideFail=false;
      return baseOff;
    }
    const side=cornerInsideSide(si);
    const power=cornerIntensity(si);
    if(now>=p.extremeInsideUntil){
      p.extremeInsideActive=false;
      p.extremeInsideFail=false;
    }
    if(side!==0 && power>.055 && !p.extremeInsideActive && now>=p.extremeInsideCooldown){
      const inside=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
      const corner=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
      const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
      const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
      const aggression=Math.max(0,Math.min(1,(p.stats.aggression-72)/27));
      const styleAttack=Math.max(-.25,Math.min(.25,(p.drivingStyle.attack-p.drivingStyle.safety)));
      // Everyone has a small chance; elite inside-line racers try it much more often.
      const attemptChance=.055 + inside*.185 + Math.max(0,styleAttack)*.075 + aggression*.030;
      if(Math.random()<attemptChance){
        const successChance=Math.max(.42,Math.min(.94,.50+inside*.16+corner*.11+control*.10+read*.08-aggression*.045));
        p.extremeInsideActive=true;
        p.extremeInsideFail=Math.random()>=successChance;
        p.extremeInsideSide=side;
        p.extremeInsideUntil=now+720+Math.random()*520;
        p.extremeInsideCooldown=now+1500+Math.random()*1800;
      }else{
        p.extremeInsideCooldown=now+420+Math.random()*650;
      }
    }
    if(!p.extremeInsideActive || !p.extremeInsideSide) return baseOff;
    const routeHalf=Math.max(2.0,widths[si]*ROAD_MARGIN);
    // Successful attempt skims just inside the lethal boundary. Failed attempt goes
    // one step too deep; there is no fake random death — the ordinary course death
    // detector kills the racer only if the driven position actually crosses the edge.
    const depth=routeHalf+DEATH_EDGE_EXTRA+(p.extremeInsideFail?.78:-.62);
    return p.extremeInsideSide*depth;
  }

  function stabilizeDrivingLine(p,si,targetOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const density=playerPerceivedObservers(p,15).length;
    const corner=cornerIntensity(si);
    const lineSkill=((p.stats.cornering+p.stats.insideLine+p.stats.control)/3-72)/27;

    // v2.27: on a genuinely clear corner, high-skill racers may use the full
    // extreme inside edge. Traffic progressively restores a larger safety margin.
    let edge;
    if(density===0 && corner>.045) edge=.999;
    else edge=density>=7?.82:density>=4?.87:.94;
    targetOff=Math.max(-half*edge,Math.min(half*edge,targetOff));

    if(p._stableOff==null) p._stableOff=targetOff;
    const maxStep=half*(.105+lineSkill*.065);
    const delta=targetOff-p._stableOff;
    p._stableOff+=Math.max(-maxStep,Math.min(maxStep,delta));
    return p._stableOff;
  }

  function humanDrivingAdjustment(p,si,now,baseOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.54);
    const control=(p.stats.control-72)/27;
    const reaction=(p.stats.reaction-72)/27;
    const prediction=(p.stats.prediction-72)/27;
    const stability=(p.stats.stability-72)/27;
    const risk=(p.stats.riskControl-72)/27;

    if(now>=p.humanModeUntil){
      const formShift=(1-p.raceForm)*.32;
      const roll=Math.max(0,Math.min(1,Math.random()+formShift));
      if(roll<.10) p.humanMode=1;       // compact weave
      else if(roll<.15) p.humanMode=2;  // short wait
      else if(roll<.22) p.humanMode=3;  // wide safety line
      else p.humanMode=0;
      p.humanModeUntil=now+420+Math.random()*680;
      p.humanPhase+=1.11;
    }

    let off=baseOff, speedMul=1;

    // v4.67 OPTIMAL-LINE DISCIPLINE:
    // Never take a deliberately wide route merely for personality/safety.
    // Wide movement is reserved for a real observer threat handled by avoidance.
    const survival=p.survivalNorm||0;
    const inside=cornerInsideSide(si)||Math.sign(futureInsideBias(si));
    p.wideDetourRace=false;

    if(p.humanMode===1){
      off+=Math.sin(now*.012+p.humanPhase)*half*(.025+(1-control)*.045);
    }else if(p.humanMode===2){
      // v4.86: no cosmetic clear-road hesitation; judgment differences appear under pressure.
      speedMul=playerPerceivedObservers(p,18).length===0?1:(.965+reaction*.020+prediction*.012);
    }else if(p.humanMode===3){
      // v4.67: no cosmetic/safety-wide lane. Keep the optimized line.
      off=baseOff;
      speedMul=1;
    }

    if(now>=p.decisionErrorUntil){
      const errorChance=.0012+(1-(reaction+prediction+stability)/3)*.0048;
      if(Math.random()<errorChance) p.decisionErrorUntil=now+170+Math.random()*210;
    }
    if(now<p.decisionErrorUntil){
      off+=Math.sin(now*.018+p.index)*half*(.012+(1-stability)*.025);
      speedMul*=.988;
    }
    // v2.45: persistent individual route identity keeps racers from stacking
    // on the same optimized line even when no observer forces a deviation.
    const clearIdentity68=playerPerceivedObservers(p,18).length===0;
    const identityWave=Math.sin(now*.00115+p.routeIdentityPhase)*half*(clearIdentity68?.012:.10) +
      (p.laneSignatureWave||0)*half*(clearIdentity68?.04:1);
    const identityBias=(p.routeIdentityBias||0)*half*(clearIdentity68?.025:.24);
    const approachInside=openingInsideBias(si);
    const openingFast=openingFastLineTarget(p,si);
    const identityKeep=clearIdentity68?.985:(openingFast!=null ? .88 : (Math.abs(approachInside)>.08 ? .92 : .79));
    const identityScale=clearIdentity68?.08:(openingFast!=null ? .42 : (Math.abs(approachInside)>.08 ? .34 : 1));
    off=off*identityKeep + (identityBias + identityWave)*identityScale;
    if(openingFast!=null) off=off*.18+openingFast*.82;
    off=creativeRouteAdjustment(p,si,now,off);
    return {off:Math.max(-half*.995,Math.min(half*.995,off)),speedMul};
  }

  function optimizedLookAheadTarget(p,si,now){
    const routeRead=(p.stats.routeReading-72)/27;
    const maxAhead=Math.min(segs.length-1,si+6+Math.round(routeRead*2));
    const plannedOff=plannedRacingOffset(p,si,now);

    // v4.07 ROUTE-FOLLOWING: lookahead may smooth a bend, but it must never
    // turn the course into a straight chord across off-road space. Around the
    // 5-o'clock rise especially, advance only to the next route joint first.
    const routeLocked = si<=10;
    const openingFast=openingFastLineTarget(p,si);
    // v4.16: the opening straight is allowed a longer same-corridor lookahead so
    // steering visibly forms a diagonal toward the inside wall. Course validation
    // below still rejects any chord that would cross a non-drivable gap.
    let ahead=Math.min(segs.length-1,si+(openingFast!=null?3:(routeLocked?1:3)));
    let strongest=0;
    const scanEnd=openingFast!=null?Math.min(maxAhead,si+5):(routeLocked?Math.min(maxAhead,si+2):maxAhead);
    for(let j=si+1;j<=scanEnd;j++){
      const a=segs[Math.max(0,j-1)];
      const b=segs[j];
      const turn=a.ux*b.uy-a.uy*b.ux;
      if(Math.abs(turn)>Math.abs(strongest)){
        strongest=turn;
        if(!routeLocked) ahead=j;
      }
    }

    const targetSeg=segs[ahead];
    let targetOff=plannedOff*0.58;
    if(Math.abs(strongest)>0.02){
      const half=Math.max(1.7,widths[ahead]*0.64);
      const skill=((p.stats.cornering+p.stats.insideLine+p.stats.routeReading)/3-72)/27;
      targetOff=(strongest>0 ? 1 : -1)*half*Math.min(.997,.94+skill*.057);
    }
    if(openingFast!=null){
      const targetHalf=Math.max(1.8,widths[ahead]*1.06);
      const sign=Math.sign(openingFast)||Math.sign(targetOff)||1;
      targetOff=sign*targetHalf*.965;
    }

    const phase=cornerPhaseTarget(p,si,Math.max(1.8,widths[si]*.56));
    if(phase.weight>.20){
      const blend=Math.min(.34,.12+phase.weight*.32);
      targetOff=targetOff*(1-blend)+phase.target*blend;
    }

    let x=targetSeg.b[0]+targetSeg.nx*targetOff;
    let y=targetSeg.b[1]+targetSeg.ny*targetOff;

    // v4.07: no artificial 5-o'clock vertical shortcut. Racers must reach the
    // actual bend through the painted route before beginning the upward section.

    return {x,y,off:plannedOff};
  }


  // v2.14: start / finish / clutch situation logic.
  // No trailing-speed bonus: late-race changes are route/risk/decision changes only.
  function finalCornerBattleTarget(p,si,now,baseOff){
    const ratio=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    if(ratio<.88) return baseOff;
    let nearest=999,ahead=999;
    const my=currentProgress(p);
    for(const q of players){
      if(q===p||q.done) continue;
      const g=currentProgress(q)-my;
      nearest=Math.min(nearest,Math.abs(g));
      if(g>0) ahead=Math.min(ahead,g);
    }
    if(nearest>5.8) return baseOff;
    const side=cornerInsideSide(si)||Math.sign(futureInsideBias(si));
    if(!side) return baseOff;
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.585);
    const pressure=(p.stats.pressure-72)/27;
    const control=(p.stats.control-72)/27;
    const inside=(p.stats.insideLine-72)/27;
    const attack=Math.max(0,Math.min(1,(pressure+control+inside)/3));
    const chasing=ahead<5.8;
    const commit=chasing?Math.min(.999,.91+attack*.085):Math.min(.985,.82+attack*.12);
    const target=side*half*commit;
    if(now<p.finalCornerUntil) return baseOff*.20+p.finalCornerOffset*.80;
    p.finalCornerOffset=target;
    p.finalCornerUntil=now+420+attack*240;
    return baseOff*.28+target*.72;
  }

  function clutchRacePlan(p,si,now){
    const prog=currentProgress(p);
    const ratio=Math.max(0,Math.min(1,prog/routeLength));
    if(ratio<.78) return null;

    const rs=liveRaceSituation(p);
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.575);
    const pressure=(p.stats.pressure-72)/27;
    const focus=(p.stats.focus-72)/27;
    const control=(p.stats.control-72)/27;
    const aggression=(p.stats.aggression-72)/27;
    const riskControl=(p.stats.riskControl-72)/27;
    const prediction=(p.stats.prediction-72)/27;
    const consistency=(p.stats.consistency-72)/27;
    const inside=cornerInsideSide(si);
    const future=futureInsideBias(si);
    const nearby=playerPerceivedObservers(p,12.0);

    if(now<p.clutchDecisionUntil){
      return {off:p.clutchLineOffset,speedMul:p.clutchSpeedMul};
    }

    // Detect a real finish fight using nearby progress, not physical contact.
    let nearestGap=999, nearestBehind=999;
    for(let i=0;i<players.length;i++){
      const q=players[i];
      if(q===p || q.done) continue;
      const g=currentProgress(q)-prog;
      if(g>0 && g<nearestGap) nearestGap=g;
      if(g<0 && -g<nearestBehind) nearestBehind=-g;
    }
    const closeFight=Math.min(nearestGap,nearestBehind)<5.3;
    const veryLate=ratio>.90;
    const finalSprint=ratio>.955;
    const leaderProtect=rs.rank===1;
    const chasing=rs.rank>=2 && nearestGap<7.0;

    let off=0, speedMul=1;
    const cornerSide=inside!==0?inside:(Math.abs(future)>.12?Math.sign(future):0);

    if(leaderProtect){
      // v2.62: a leader with breathing room values survival; a pressured leader still races.
      const safe=(focus*.38+riskControl*.34+consistency*.28);
      const comfortableLead=nearestBehind>4.8;
      if(cornerSide!==0 && nearby.length<=1){
        const commit=Math.min(.92,.56+safe*.20+(comfortableLead?.06:0));
        off=cornerSide*half*commit;
      }
      // Protecting the lead means line choice, never a hidden speed bonus.
      if(finalSprint && nearby.length===0 && cornerSide!==0){
        off=cornerSide*half*Math.min(.985,.74+safe*.18);
      }
      speedMul=1;
    } else if(chasing && closeFight){
      // Chasers may take a more decisive route in the final section.
      const clutch=(pressure*.34+control*.24+prediction*.22+aggression*.20);
      const gambleChance=Math.min(.76,.22+clutch*.30+(veryLate?.14:0)+(p.cleanConfidence||0)*.08);
      if(Math.random()<gambleChance && nearby.length<=2){
        let side=cornerSide;
        if(side===0) side=(p.index%2?1:-1);
        const commit=Math.min(.995,.72+clutch*.18+(veryLate?.05:0));
        off=side*half*commit;
      } else if(nearby.length>1){
        // In danger, high-pressure racers pick the cleaner escape rather than blindly force a pass.
        const s=segs[Math.min(si,segs.length-1)];
        let left=0,right=0;
        for(let i=0;i<nearby.length;i++){
          const o=nearby[i],dx=o.x-p.x,dy=o.y-p.y;
          const along=dx*s.ux+dy*s.uy;
          if(along<0 || along>10) continue;
          const lat=dx*s.nx+dy*s.ny;
          if(lat<0) left++; else right++;
        }
        off=(left<=right?-1:1)*half*(.48+prediction*.18);
      }
      // In the final 4.5%, a close chaser commits harder to the shortest safe apex.
      if(finalSprint && nearby.length===0){
        let finishSide=cornerSide||((p.index%2)?1:-1);
        off=finishSide*half*Math.min(.995,.82+clutch*.15);
      }
      speedMul=1;
    } else if(veryLate && rs.rank>=4){
      // Deep in the pack near the finish: more risk, but still no raw speed boost.
      const clutch=(pressure+aggression+control)/3;
      if(Math.random()<(.10+clutch*.16) && nearby.length===0){
        let side=cornerSide||((p.index%2)?1:-1);
        off=side*half*Math.min(.98,.72+clutch*.20);
      }
    }

    p.clutchLineOffset=off;
    p.clutchSpeedMul=speedMul;
    p.clutchDecisionUntil=now+260+Math.random()*280;
    return {off,speedMul};
  }

  function limitDecisionChanges(p,si,now,targetOff){
    const half=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.58);
    const nearby=playerPerceivedObservers(p,8.5);
    let emergency=false;
    for(const o of nearby){
      const dx=o.x-p.x,dy=o.y-p.y;
      if(dx*dx+dy*dy<8.0){emergency=true;break;}
    }
    if(emergency){
      p.decisionLockUntil=0;
      p.decisionLockOffset=targetOff;
      return targetOff;
    }
    if(now<p.decisionLockUntil){
      const delta=Math.abs(targetOff-p.decisionLockOffset);
      const sideFlip=Math.sign(targetOff)!==0&&Math.sign(p.decisionLockOffset)!==0&&
        Math.sign(targetOff)!==Math.sign(p.decisionLockOffset);
      if(sideFlip || delta>half*.52) return p.decisionLockOffset*.78+targetOff*.22;
      return p.decisionLockOffset*.55+targetOff*.45;
    }
    p.decisionLockOffset=targetOff;
    const stability=(p.stats.stability-72)/27;
    p.decisionLockUntil=now+260+stability*190;
    return targetOff;
  }

  function segmentPointDistanceSq(ax,ay,bx,by,px,py){
    const vx=bx-ax,vy=by-ay,wx=px-ax,wy=py-ay;
    const vv=vx*vx+vy*vy;
    if(vv<1e-10){const dx=px-ax,dy=py-ay;return dx*dx+dy*dy;}
    const t=Math.max(0,Math.min(1,(wx*vx+wy*vy)/vv));
    const dx=(ax+vx*t)-px,dy=(ay+vy*t)-py;
    return dx*dx+dy*dy;
  }
  function playerObserverHit(p,o){
    // v3.7 RELATIVE-MOTION SWEPT COLLISION:
    // Sweep BOTH moving objects over the same 20 ms simulation step.
    // In relative coordinates this is one segment from
    // (playerPrev-observerPrev) to (playerNow-observerNow) against the origin.
    // This prevents fast crossing contacts from being missed and avoids inflating HIT.
    const r=PLAYER_HIT_RADIUS;
    const opx=Number.isFinite(o.simPrevX)?o.simPrevX:o.x;
    const opy=Number.isFinite(o.simPrevY)?o.simPrevY:o.y;
    const r0x=p.simPrevX-opx, r0y=p.simPrevY-opy;
    const r1x=p.x-o.x, r1y=p.y-o.y;
    if(segmentPointDistanceSq(r0x,r0y,r1x,r1y,0,0)<r*r) return true;
    return r1x*r1x+r1y*r1y<r*r;
  }

  // v4.48 START AI: racers still spawn at exactly the same v6.04 start-safe coordinate. Start, Reaction,
  // Acceleration and personality decide how quickly and how strongly each racer fans into
  // a legal opening line. Observer avoidance below always has final authority.
  function startOpeningTarget(p,si,now,targetOff){
    if(!raceStart || now>=p.startDecisionUntil || si>2) return targetOff;
    const elapsed=Math.max(0,now-raceStart-p.startReactionMs);
    if(elapsed<=0) return targetOff;
    const startN=Math.max(0,Math.min(1,(p.stats.start-72)/27));
    const reactN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
    const accelN=Math.max(0,Math.min(1,(p.stats.acceleration-72)/27));
    const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const identity=identityOf(p);
    const ramp=Math.max(0,Math.min(1,elapsed/(330-reactN*90)));
    const settle=Math.max(0,Math.min(1,(p.startDecisionUntil-now)/620));
    const blend=Math.min(.84,(.34+startN*.20+reactN*.10+controlN*.08)*(p.startLineCommit||.7)*1.24*ramp*Math.max(.48,settle));
    // Strong starters establish their chosen lane earlier; acceleration affects execution, not hidden pace.
    let executed=p.startLineTarget*(.86+accelN*.10+controlN*.04);
    // v4.62: while the first-corner optimizer is available, trust its topology-derived
    // fast side more than the old personal opening lane. This specifically prevents
    // a racer from choosing a visibly slower side on the long opening approach.
    const openingFast=openingFastLineTarget(p,si);
    if(openingFast!=null){
      const fastTrust=.82+Math.max(0,Math.min(1,(p.stats.routeReading-72)/27))*.10;
      executed=executed*(1-fastTrust)+openingFast*fastTrust;
    }
    return targetOff*(1-blend)+executed*blend;
  }

  
  // v4.80-v4.84 INTEGRATED OBSERVER AI
  // 4.80 future-threat prediction 3.0 / 4.81 minimum dodge 2.0 /
  // 4.82 inside-line preservation / 4.83 multi-observer escape corridor 3.0 /
  // 4.84 instant optimal-line rejoin 5.0.
  function fastReference84(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const macro=optimalRacingLine2Offset(p,idx);
    const corner=cornerPhysics64Target(p,idx,macro).off;
    const linked=integratedFastLine74(p,idx,corner);
    return raceLine79(p,idx,linked,false);
  }

  function predictedThreatSet84(p,s,now,r=26){
    const raw=playerPerceivedObservers(p,r,now);
    const out=[];
    for(const o of raw){
      const dx=o.x-p.x,dy=o.y-p.y;
      const along=dx*s.ux+dy*s.uy;
      const lat=dx*s.nx+dy*s.ny;
      if(along<-3.0 || along>24.0) continue;
      const rvx=(o.vx||0)-s.ux*p.speed;
      const rvy=(o.vy||0)-s.uy*p.speed;
      const rv2=rvx*rvx+rvy*rvy;
      let tc=99,cpa=Math.hypot(dx,dy);
      if(rv2>.01){
        tc=Math.max(0,Math.min(3.6,-(dx*rvx+dy*rvy)/rv2));
        cpa=Math.hypot(dx+rvx*tc,dy+rvy*tc);
      }
      // 4.80: only projected conflict / genuinely occupied forward space is a threat.
      const projected=tc<3.45 && cpa<5.4;
      const occupied=along>-.6 && along<12.5 && Math.abs(lat)<4.6;
      if(projected || occupied) out.push({o,along,lat,tc,cpa});
    }
    out.sort((a,b)=>(a.tc-b.tc)||(a.cpa-b.cpa));
    return out;
  }

  function minimumEscape84(p,s,legacy,now){
    if(!legacy || legacy.mode==="stop") return legacy;
    const threats=predictedThreatSet84(p,s,now,28);
    if(!threats.length) return null;

    const nearby=threats.map(t=>t.o);
    const idx=Math.min(p.seg,widths.length-1);
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const fast=fastReference84(p,idx);
    const current=((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
    const skill=Math.max(0,Math.min(1,
      (((p.stats.avoidance+p.stats.prediction+p.stats.reaction+p.stats.control)/4)-72)/27));
    const required=2.15+skill*.28;

    // 4.81/4.82: search from the fastest inside line outward. The first genuinely
    // safe compact lane wins; do not jump to the legacy wide dodge by default.
    const legacyOff=Number.isFinite(legacy.targetOff)?legacy.targetOff:fast;
    const toward=legacyOff-fast;
    const candidates=[
      fast,
      fast+toward*.22,
      fast+toward*.38,
      fast+toward*.55,
      fast+toward*.72,
      legacyOff
    ];

    // 4.83: with several observers, also inspect compact escape corridors on BOTH
    // sides, but keep the search close to the racing line before considering extremes.
    if(threats.length>=2){
      for(const f of [.18,.32,.46,.60]){
        candidates.push(fast-half*f,fast+half*f);
      }
    }

    let best=null;
    const seen=[];
    for(let off of candidates){
      off=clampRoadOffset(idx,off,p);
      if(seen.some(v=>Math.abs(v-off)<.08)) continue;
      seen.push(off);
      const risk=candidateAvoidanceRisk(p,s,off,legacy.speedMul||.998,nearby);
      const deviation=Math.abs(off-fast);
      // Prefer safety first, then minimum movement and preservation of the fast/inside lane.
      const safeEnough=risk.minClear>=required;
      const score=risk.score + deviation*(safeEnough?.52:.10) + Math.abs(off-current)*.06;
      if(!best || (safeEnough&&!best.safeEnough) ||
         (safeEnough===best.safeEnough && score<best.score)){
        best={off,risk,score,safeEnough};
      }
    }
    if(!best) return legacy;

    // If no compact candidate meets required clearance, trust the safest scored lane,
    // but cap gratuitous exterior travel unless this is a true close emergency.
    let off=best.off;
    const emergency=best.risk.minClear<1.12 || threats.some(t=>t.tc<.62 && t.cpa<1.55);
    const maxDev=half*(emergency?.88:(threats.length>=2?.66:.54));
    const d=off-fast;
    if(Math.abs(d)>maxDev) off=fast+Math.sign(d)*maxDev;

    return {
      mode:legacy.mode||"planned",
      targetOff:clampRoadOffset(idx,off,p),
      speedMul:legacy.speedMul||.998,
      risk:best.risk.score,
      minClear:best.risk.minClear,
      threatCount84:threats.length
    };
  }

  function chooseAvoidance(p,s,now){
    const legacy=chooseAvoidanceLegacy84(p,s,now);
    return minimumEscape84(p,s,legacy,now);
  }


  // v4.85-v4.89 RACE AI 5.0 COMPLETION
  // 4.85 leader survival 2.0 / 4.86 human judgment 3.0 /
  // 4.87 stat-driven execution 3.0 / 4.88 unified situation score 4.0 /
  // 4.89 final race-AI balance and anti-abnormal-routing pass.
  function executionSkill87(p){
    const inside=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
    const corner=Math.max(0,Math.min(1,(p.stats.cornering-72)/27));
    const control=Math.max(0,Math.min(1,(p.stats.control-72)/27));
    const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
    const predict=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
    return inside*.24+corner*.22+control*.21+read*.18+predict*.15;
  }

  function situationScore88(p,si,now,targetOff,avoid=null,passActive=false){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);
    const fast=fastReference84(p,idx);
    const rs=liveRaceSituation(p);
    const exec=executionSkill87(p);

    let threat=0;
    if(avoid){
      const mc=Number.isFinite(avoid.minClear)?avoid.minClear:9;
      threat=Math.max(0,Math.min(1,(3.2-mc)/3.2));
    }
    const leaderPressure=(rs.rank===1 && rs.nearestBehindGap<7.5) ||
                         (rs.rank===2 && rs.nearestAheadGap<7.5);
    const routeCost=Math.min(1,Math.abs(targetOff-fast)/Math.max(1,half));
    const passNeed=passActive?1:0;

    // 4.88: route time, observer danger, traffic, next-corner geometry and recovery
    // are collapsed into one compact authority score.
    let fastAuthority=.86 + exec*.10;
    fastAuthority += leaderPressure?.025:0;
    fastAuthority -= threat*.42;
    fastAuthority -= passNeed*.24;
    fastAuthority -= routeCost*.05;
    fastAuthority=Math.max(.42,Math.min(.985,fastAuthority));
    return {fast,fastAuthority,threat,leaderPressure,exec};
  }

  function finalRaceDiscipline89(p,si,now,targetOff,avoid=null,passActive=false){
    const info=situationScore88(p,si,now,targetOff,avoid,passActive);
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const half=Math.max(1.8,widths[idx]*ROAD_MARGIN*.965);

    // 4.85 leaders: survive, but never panic-route unless there is a real close threat.
    if(info.leaderPressure && avoid && info.threat<.42){
      const cap=half*.40;
      const d=targetOff-info.fast;
      targetOff=info.fast+Math.sign(d)*Math.min(Math.abs(d),cap);
    }

    // 4.89 final abnormal-route clamp. On clear road there is no justification for
    // a large exterior excursion. During a pass or threat, allow proportionate room.
    const maxDev=half*(avoid ? (.48+info.threat*.30) : (passActive?.46:.20));
    const d=targetOff-info.fast;
    if(Math.abs(d)>maxDev){
      targetOff=info.fast+Math.sign(d)*maxDev;
    }

    // 4.87: stronger racers execute the same optimal route more precisely; weaker
    // racers differ by small timing/precision error, never by deliberately bad macro paths.
    const precisionAuthority=avoid ? Math.max(.18,info.fastAuthority*.34) : info.fastAuthority;
    targetOff=targetOff*(1-precisionAuthority)+info.fast*precisionAuthority;
    return clampRoadOffset(idx,targetOff,p);
  }


  // v4.90 RACE AI 5.1 — CONTINUOUS STEERING
  // Do not hard-code screenshot coordinates. Every route segment uses the same rule:
  // preserve forward direction, blend into the next tangent gradually, and cap how
  // sharply the virtual-mouse target can rotate during ordinary racing.
  
  // v4.91 RACE AI 5.2 — NO ORTHOGONAL DROP
  // Generic route-geometry solution: choose the farthest future racing-line point
  // that can be reached by ONE legal chord. This naturally creates long diagonals
  // across wide corridors and removes the old "straight, then 90-degree drop" shape.
  // No screenshot coordinates or hand-drawn line coordinates are encoded here.
  
  // v4.92 STRAIGHT-CORRIDOR PRIORITY
  // If the racer is already travelling mainly horizontally and the same horizontal
  // chord remains inside the survivable road corridor, keep going straight.
  // This deliberately ignores an upcoming vertical route joint when that joint is
  // slower than simply continuing across the legal horizontal road.
  // No screenshot coordinates / hand-marked line coordinates are used.
  
  // v4.93 PERSISTENT MACRO-STRAIGHT
  // Once a long legal horizontal chord is found, KEEP that target even if the logical
  // route index temporarily advances into a vertical connector. The hold ends only
  // when the racer physically reaches the far horizontal road or a true emergency occurs.
  
  // v4.94 GLOBAL ROUTE-SHORTCUT GRAPH
  // The old AI assumed every route[] joint must be visited in sequence. That is wrong
  // on wide corridors: some centerline joints form a needless dogleg even though a
  // direct chord across the painted road is shorter and fully legal.
  //
  // This planner is generic: no screenshot coordinates and no special segment IDs.
  // It compares route-arc distance vs direct legal chord and skips intermediate joints
  // whenever the chord is materially shorter.
  function routeArcDistance94(fromSeg,toSeg){
    fromSeg=Math.max(0,Math.min(segs.length-1,fromSeg));
    toSeg=Math.max(fromSeg,Math.min(segs.length-1,toSeg));
    let d=0;
    for(let i=fromSeg;i<=toSeg;i++) d+=segs[i].L;
    return d;
  }

  
  // v4.95 TRUE HORIZONTAL RUN LOCK
  // Detect a run of several route segments that all travel mostly horizontally in
  // the same direction. Once entered, preserve the racer's screen-Y and aim directly
  // across the run. No lateral offset optimizer is allowed to drag the unit vertically.
  function horizontalRun95(si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s0=segs[idx];
    if(Math.abs(s0.ux)<.90) return null;
    const dir=Math.sign(s0.ux)||1;
    let end=idx,total=0;
    for(let j=idx;j<segs.length;j++){
      const s=segs[j];
      if(Math.abs(s.ux)<.88 || Math.sign(s.ux)!==dir) break;
      total+=s.L;
      end=j;
    }
    if(end-idx<2 || total<28) return null;
    return {start:idx,end,dir,total};
  }

  function horizontalTarget95(p,si,now,emergency=false){
    if(emergency){
      p.horizontal95Until=0;
      return null;
    }

    // Continue a committed horizontal run even if the logical segment advances.
    if((p.horizontal95Until||0)>now && Number.isFinite(p.horizontal95Y) && Number.isFinite(p.horizontal95X)){
      const dx=p.horizontal95X-p.x;
      if((p.horizontal95Dir||1)*dx>2.2){
        return {x:p.horizontal95X,y:p.horizontal95Y,end:p.horizontal95End};
      }
      p.horizontal95Until=0;
    }

    const run=horizontalRun95(si);
    if(!run) return null;

    const endSeg=segs[run.end];
    // Preserve current vertical position. Clamp only if that exact horizontal chord
    // would leave the legal road; otherwise do not move vertically at all.
    let y=p.y;
    let x=endSeg.b[0]+run.dir*2.0;

    if(!lineStaysOnCourse(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)){
      // Fall back toward the current segment centerline in small steps, never to a
      // preselected edge row.
      const centerY=segs[si].b[1];
      let found=false;
      for(const k of [.18,.34,.50,.66,.82,1]){
        const cy=p.y+(centerY-p.y)*k;
        if(lineStaysOnCourse(p.x,p.y,x,cy,ROUTE_PLAN_EXTRA)){
          y=cy; found=true; break;
        }
      }
      if(!found) return null;
    }

    p.horizontal95Y=y;
    p.horizontal95X=x;
    p.horizontal95Dir=run.dir;
    p.horizontal95End=run.end;
    p.horizontal95Until=now+5200;
    return {x,y,end:run.end};
  }

function bestRouteShortcut94(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const maxJ=Math.min(segs.length-1,idx+10);
    let best=null;

    // Search all future route segments, not just the next joint.
    for(let j=idx+2;j<=maxJ;j++){
      const s=segs[j];
      const half=Math.max(2.0,widths[j]*ROAD_MARGIN*.972);
      // Evaluate several lateral points on the future road. This lets the shortcut
      // land naturally on the fastest side of a wide corridor.
      const fracs=[-.92,-.65,-.35,0,.35,.65,.92];
      for(const f of fracs){
        const x=s.b[0]+s.nx*f*half;
        const y=s.b[1]+s.ny*f*half;
        const direct=Math.hypot(x-p.x,y-p.y);
        if(direct<8) continue;
        if(!lineStaysOnCourse(p.x,p.y,x,y,ROUTE_PLAN_EXTRA*.92)) continue;

        // Compare against the actual route arc remaining from the racer's current
        // position through every intermediate joint.
        const cur=segs[idx];
        const rx=p.x-cur.a[0],ry=p.y-cur.a[1];
        const along=Math.max(0,Math.min(cur.L,rx*cur.ux+ry*cur.uy));
        let arc=Math.max(0,cur.L-along);
        for(let k=idx+1;k<=j;k++) arc+=segs[k].L;

        const gain=arc-direct;
        const ratio=direct/Math.max(1,arc);
        // Require a real distance saving. Tiny corner cuts stay with normal racing AI.
        if(gain<5.0 || ratio>.90) continue;

        // Prefer maximum real distance saving, with a small reward for skipping more
        // unnecessary joints. This directly rejects doglegs.
        const score=gain+(j-idx)*.45;
        if(!best || score>best.score){
          best={x,y,j,f,direct,arc,gain,ratio,score};
        }
      }
    }
    return best;
  }

  function routeShortcutTarget94(p,si,now,emergency=false){
    if(emergency){
      p.routeShortcut94Until=0;
      return null;
    }

    // Persist the selected shortcut until the racer reaches its landing road.
    if((p.routeShortcut94Until||0)>now && Number.isFinite(p.routeShortcut94X)){
      const dx=p.routeShortcut94X-p.x,dy=p.routeShortcut94Y-p.y;
      if(Math.hypot(dx,dy)>3.2){
        return {x:p.routeShortcut94X,y:p.routeShortcut94Y,j:p.routeShortcut94Seg,held:true};
      }
      p.routeShortcut94Until=0;
    }

    const best=bestRouteShortcut94(p,si);
    if(!best) return null;
    p.routeShortcut94X=best.x;
    p.routeShortcut94Y=best.y;
    p.routeShortcut94Seg=best.j;
    p.routeShortcut94Until=now+4600;
    return {x:best.x,y:best.y,j:best.j,held:true};
  }

function discoverMacroStraight93(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];

    // Use route geometry, NOT current steer. This prevents an already-started bad turn
    // from disabling the correction.
    if(Math.abs(s.ux)<.78 || Math.abs(s.ux)<Math.abs(s.uy)*1.75) return null;
    const dir=Math.sign(s.ux)||1;

    // Scan much farther than v4.92. The user's long 3->9 / 11->1 corridors span
    // many route segments, so a short 72-unit probe was insufficient.
    const extra=DEATH_EDGE_EXTRA-.18;
    let best=null;
    for(let dist=138;dist>=18;dist-=2){
      const x=p.x+dir*dist, y=p.y;
      if(x<2.5 || x>MAP_W-2.5) continue;
      if(lineStaysOnCourse(p.x,p.y,x,y,extra)){
        best={x,y,dist,dir};
        break;
      }
    }
    return best && best.dist>=24 ? best : null;
  }

  function macroStraightTarget93(p,si,now,emergency=false){
    // A real observer emergency may break the straight hold immediately.
    if(emergency){
      p.macroStraight93Until=0;
      return null;
    }

    // Continue an already committed straight until physically near its endpoint.
    if((p.macroStraight93Until||0)>now && Number.isFinite(p.macroStraight93X)){
      const dx=p.macroStraight93X-p.x,dy=p.macroStraight93Y-p.y;
      const ahead=(p.macroStraight93Dir||1)*dx;
      if(Math.hypot(dx,dy)>3.0 && ahead>1.2){
        return {x:p.macroStraight93X,y:p.macroStraight93Y,held:true};
      }
      p.macroStraight93Until=0;
    }

    const found=discoverMacroStraight93(p,si);
    if(!found) return null;

    // Persist across logical vertical connector segments. Timeout is only a fail-safe.
    p.macroStraight93X=found.x;
    p.macroStraight93Y=found.y;
    p.macroStraight93Dir=found.dir;
    p.macroStraight93Until=now+5200;
    return {x:found.x,y:found.y,held:true};
  }

function farthestVisibleFastTarget91(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    let best=null;
    const maxLook=Math.min(segs.length-1,idx+8);

    // Test future segment end points from far to near. Each candidate uses that
    // segment's own optimized fast offset, so edge/inside-line legality is preserved.
    for(let j=maxLook;j>=idx+1;j--){
      const sj=segs[j];
      const macro=optimalRacingLine2Offset(p,j);
      const corner=cornerPhysics64Target(p,j,macro).off;
      const linked=integratedFastLine74(p,j,corner);
      const off=raceLine79(p,j,linked,false);
      const x=sj.b[0]+sj.nx*off;
      const y=sj.b[1]+sj.ny*off;
      if(lineStaysOnCourse(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)){
        best={x,y,j,off};
        break;
      }
    }

    if(best) return best;

    // Fallback: current fast line endpoint.
    const s=segs[idx];
    const off=fastReference84(p,idx);
    return {x:s.b[0]+s.nx*off,y:s.b[1]+s.ny*off,j:idx,off};
  }

  function noOrthogonalDrop91(p,si,tx,ty,emergency=false){
    if(emergency){
      p.horizontal95Until=0;
      p.routeShortcut94Until=0;
      p.macroStraight93Until=0;
      return {x:tx,y:ty};
    }

    const idx=Math.max(0,Math.min(segs.length-1,si));

    // v4.95: on a true long horizontal run, preserve screen-Y and go straight.
    const horizontal95=horizontalTarget95(p,idx,performance.now(),false);
    if(horizontal95) return {x:horizontal95.x,y:horizontal95.y};

    // v4.94: otherwise ask whether the route centerline itself contains a slower dogleg.
    // If a much shorter legal chord exists, skip those intermediate route joints.
    const shortcut94=routeShortcutTarget94(p,idx,performance.now(),false);
    if(shortcut94) return {x:shortcut94.x,y:shortcut94.y};

    // v4.93 fallback: persistent horizontal macro-line.
    const straight93=macroStraightTarget93(p,idx,performance.now(),false);
    if(straight93) return {x:straight93.x,y:straight93.y};

    const vis=farthestVisibleFastTarget91(p,idx);

    // Prefer the farthest legal chord over local segment-joint targets.
    // This is the key difference from v4.90: the AI no longer waits for a joint
    // and then turns downward/vertical. It aims through the corridor in one line.
    let x=vis.x, y=vis.y;

    // Never commit a calm-racing click that is close to perpendicular to the current
    // motion. If necessary, rotate it toward current momentum while retaining a
    // forward component. Real emergency avoidance bypasses this filter.
    let hx=p.steerX||segs[idx].ux, hy=p.steerY||segs[idx].uy;
    let hl=Math.hypot(hx,hy)||1; hx/=hl; hy/=hl;
    let dx=x-p.x, dy=y-p.y;
    let d=Math.hypot(dx,dy)||1; dx/=d; dy/=d;
    let angle=Math.atan2(hx*dy-hy*dx,hx*dx+hy*dy);

    const maxTurn=52*Math.PI/180; // calm-racing click can never be an L-turn
    if(Math.abs(angle)>maxTurn){
      angle=Math.sign(angle)*maxTurn;
      const ca=Math.cos(angle),sa=Math.sin(angle);
      const ndx=hx*ca-hy*sa, ndy=hx*sa+hy*ca;
      const look=Math.max(10,Math.min(24,d));
      x=p.x+ndx*look; y=p.y+ndy*look;
      const legal=courseAwareTarget(p,idx,x,y);
      x=legal.x; y=legal.y;
    }

    return {x,y};
  }


  
  function forwardRouteResync93(p){
    const cur=Math.max(0,Math.min(segs.length-1,p.seg));
    let best=null;
    // Search well ahead because a macro-straight may bypass several connector segments.
    const hi=Math.min(segs.length-1,cur+12);
    for(let i=cur;i<=hi;i++){
      const s=segs[i],rx=p.x-s.a[0],ry=p.y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const qx=s.a[0]+s.ux*along,qy=s.a[1]+s.uy*along;
      const dx=p.x-qx,dy=p.y-qy,d2=dx*dx+dy*dy;
      const legalR=Math.max(2.0,widths[i]*ROAD_MARGIN)+DEATH_EDGE_EXTRA-.25;
      if(d2<=legalR*legalR && (!best || d2<best.d2)) best={i,d2};
    }
    if(best && best.i>cur+1) p.seg=best.i;
  }


  // v5.01 HORIZONTAL CENTERLINE LOCK
  function horizontalCenterLock501(p,si,now){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const next=segs[Math.min(segs.length-1,idx+1)];
    const horizontal=Math.abs(s.ux)>=.88;
    const nextCompatible=!next || Math.abs(next.ux)>=.72;
    const emergency=
      now<(p.hardRouteLockUntil||0) ||
      now<(p.routeBreakCombatUntil||0) ||
      (p.liveEvadeDanger||0)>.18 ||
      !!p.liveEvadeThreat;
    if(!horizontal || !nextCompatible || emergency) return false;
    // v5.07: simply seeing an observer nearby no longer disables broad-road center travel.
    // Only a real live-evade/emergency may override it.
    return true;
  }


  // v5.03 HORIZONTAL SEGMENT HOLD
  // Preserve the current horizontal segment until its endpoint is genuinely reached.
  // This prevents early segment switching from pulling the target vertically.
  function horizontalHold503(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    if(Math.abs(s.ux)<.88) return false;
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=rx*s.ux+ry*s.uy;
    return along < s.L*.985;
  }


  // v5.07 BROAD-ROAD CORRIDOR ENGINE
  // Edge rows remain legal drivable road, but they are NOT the default reference line.
  // On broad road, calm racing prefers a center/shortest visible chord through the
  // whole road surface. Edge lines are reserved for real tactical/avoidance use.
  function roadChordLegal507(x1,y1,x2,y2,extra=ROUTE_PLAN_EXTRA){
    const dist=Math.hypot(x2-x1,y2-y1);
    const n=Math.max(3,Math.ceil(dist/.50));
    for(let k=1;k<=n;k++){
      const t=k/n;
      if(!courseContainsPoint(x1+(x2-x1)*t,y1+(y2-y1)*t,extra)) return false;
    }
    return true;
  }


  // v5.08 MAP-SPECIFIC FAST HORIZONTAL LINES
  // Middle 3->9 corridor: prefer the upper side of the broad road.
  // Final 11->1 corridor: after the last corner, hold the exit Y and drive
  // horizontally all the way to the finish instead of re-targeting downward/upward.
  function middleUpperLine508(si){
    return si>=13 && si<=18;
  }

  function finalStraight508(si){
    return si>=28 && si<=32;
  }

  function middleUpperTarget508(p,si){
    if(!middleUpperLine508(si)) return null;
    const s=segs[si];
    const half=Math.max(1.8,widths[si]*ROAD_MARGIN*.96);

    // Route direction here is right->left. Positive/negative normal sign can vary
    // by segment, so choose the candidate with smaller world Y = visually upper.
    const c1={x:s.b[0]+s.nx*half*.58,y:s.b[1]+s.ny*half*.58};
    const c2={x:s.b[0]-s.nx*half*.78,y:s.b[1]-s.ny*half*.78};
    const upper=c1.y<c2.y?c1:c2;

    // Keep the path on the real broad road; edge row remains legal but this target
    // stays slightly inside it rather than sitting on the one-tile border.
    if(roadChordLegal507(p.x,p.y,upper.x,upper.y,ROUTE_PLAN_EXTRA)) return upper;

    // If the far endpoint is too aggressive, use a forward point on the same upper lane.
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const ahead=Math.min(s.L,along+Math.max(4.0,Math.min(8.0,s.L-along)));
    const ax=s.a[0]+s.ux*ahead;
    const ay=s.a[1]+s.uy*ahead;
    const u1={x:ax+s.nx*half*.56,y:ay+s.ny*half*.76};
    const u2={x:ax-s.nx*half*.76,y:ay-s.ny*half*.76};
    const upperAhead=u1.y<u2.y?u1:u2;
    return roadChordLegal507(p.x,p.y,upperAhead.x,upperAhead.y,ROUTE_PLAN_EXTRA)
      ? upperAhead
      : null;
  }

  function finalHorizontalTarget508(p,si,now){
    if(!finalStraight508(si)) return null;
    const s=segs[si];

    // Capture exit Y once when entering the final horizontal corridor.
    if(!Number.isFinite(p.finalStraightY508) || p.finalStraightSeg508>si){
      p.finalStraightY508=p.y;
    }
    p.finalStraightSeg508=si;

    // Aim straight to the final route endpoint while preserving the captured Y.
    // If that exact horizontal chord is not legal yet, aim as far forward as possible
    // on the same Y, then extend again next frame.
    const finish=route[route.length-1];
    const dir=Math.sign(finish[0]-p.x)||1;
    const finishX=finish[0];
    const y=p.finalStraightY508;

    if(roadChordLegal507(p.x,p.y,finishX,y,ROUTE_PLAN_EXTRA)){
      return {x:finishX,y};
    }

    const maxStep=8.0;
    for(let d=maxStep;d>=4.0;d-=1.0){
      const x=p.x+dir*d;
      if(roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)){
        return {x,y};
      }
    }
    return null;
  }

  function broadRoadTarget507(p,si,now){
    const start=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[start];

    const emergency=
      now<(p.hardRouteLockUntil||0) ||
      now<(p.routeBreakCombatUntil||0) ||
      (p.liveEvadeDanger||0)>.18 ||
      !!p.liveEvadeThreat ||
      p.controlMode!=="normal";
    if(emergency) return null;

    // v5.08 explicit fast-line authority for the two user-specified horizontal runs.
    const final508=finalHorizontalTarget508(p,start,now);
    if(final508) return {...final508,kind:"final-horizontal-508"};

    const upper508=middleUpperTarget508(p,start);
    if(upper508) return {...upper508,kind:"middle-upper-508"};

    // Broad-road detection: use actual route width, but avoid forcing narrow connectors.
    const broad = widths[start] >= 7.8;
    if(!broad) return null;

    // Search forward for the farthest route-centered point that is directly visible
    // through legal road. Candidate lateral offset is intentionally ZERO by default:
    // edge rows are allowed but never the preferred baseline.
    let best=null;
    let bestScore=-1e9;
    const maxAhead=Math.min(segs.length-1,start+4);

    for(let j=start;j<=maxAhead;j++){
      const sj=segs[j];
      const samples=(j===start)?[.58,.72,.84]:[.28,.46,.62,.76];

      for(const t of samples){
        // centerline candidate of future segment
        const x=sj.a[0]+(sj.b[0]-sj.a[0])*t;
        const y=sj.a[1]+(sj.b[1]-sj.a[1])*t;

        const dx=x-p.x, dy=y-p.y;
        const d=Math.hypot(dx,dy);
        if(d<3.5) continue;

        // must be reasonably forward from current heading
        const forward=(dx*s.ux+dy*s.uy);
        if(forward<1.2 && j<=start+1) continue;

        if(!roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)) continue;

        // Favor farther progress and straighter motion. Penalize large lateral deviation
        // from the current segment direction, which is what makes edge/L doglegs unattractive.
        const progress=(j-start)+t;
        const lat=Math.abs(dx*s.nx+dy*s.ny);
        const straightness=Math.max(0,forward)/(d||1);
        const score=progress*12 + straightness*7 - lat*.42;

        if(score>bestScore){
          bestScore=score;
          best={x,y,d,j,t};
        }
      }
    }

    if(!best) return null;

    // v5.09 MOVEMENT-RADIUS LIMIT:
    // Never let calm broad-road planning send a racer far across the map in one decision.
    // Keep targets local so race position changes come from actual driving, not giant line swaps.
    const dx=best.x-p.x, dy=best.y-p.y;
    const d=Math.hypot(dx,dy);
    const maxTargetDist=11.0;
    if(d>maxTargetDist){
      const k=maxTargetDist/d;
      const lx=p.x+dx*k;
      const ly=p.y+dy*k;
      if(roadChordLegal507(p.x,p.y,lx,ly,ROUTE_PLAN_EXTRA)){
        best={...best,x:lx,y:ly,d:maxTargetDist};
      }
    }
    return best;
  }


  // v5.13 INTEGRATED STABILITY (v5.10~v5.13)
  function stabilizeTarget513(p,si,now,tx,ty,liveEvade){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s || liveEvade || p.controlMode!=="normal") return {x:tx,y:ty};
    let dx=tx-p.x, dy=ty-p.y;
    let forward=dx*s.ux+dy*s.uy;
    let lateral=dx*s.nx+dy*s.ny;

    // v5.10: separate forward and lateral movement radius.
    const maxForward=Math.max(6.0,Math.min(10.0,s.L*.72));
    const maxLateral=Math.max(.75,Math.min(1.85,widths[si]*.18));
    forward=Math.max(2.0,Math.min(maxForward,forward));
    lateral=Math.max(-maxLateral,Math.min(maxLateral,lateral));

    // v5.13: straight-road stability; strongly suppress lane hunting.
    const next=segs[Math.min(segs.length-1,si+1)];
    const turn=next ? Math.abs(s.ux*next.uy-s.uy*next.ux) : 0;
    if(turn<.055){
      const currentOff=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      const desiredLat=Math.max(-.70,Math.min(.70,-currentOff*.22));
      lateral=lateral*.22+desiredLat*.78;
    }

    // v5.12: suppress rapid left-right-left direction flips.
    const sign=Math.abs(lateral)>.12 ? Math.sign(lateral) : 0;
    if(!Number.isFinite(p.stableLatSign513)) p.stableLatSign513=sign;
    if(!Number.isFinite(p.stableLatFlipAt513)) p.stableLatFlipAt513=0;
    if(sign && p.stableLatSign513 && sign!==p.stableLatSign513){
      if(now-p.stableLatFlipAt513<520) lateral*=.18;
      else { p.stableLatFlipAt513=now; p.stableLatSign513=sign; }
    }else if(sign) p.stableLatSign513=sign;

    let candX=p.x+s.ux*forward+s.nx*lateral;
    let candY=p.y+s.uy*forward+s.ny*lateral;

    // v5.11: commit to a recent legal target briefly instead of retargeting every frame.
    const held=Number.isFinite(p.stableTargetX513)&&Number.isFinite(p.stableTargetY513);
    if(held && now<(p.stableTargetUntil513||0)){
      const hd=Math.hypot(p.stableTargetX513-p.x,p.stableTargetY513-p.y);
      if(hd>2.2 && roadChordLegal507(p.x,p.y,p.stableTargetX513,p.stableTargetY513,ROUTE_PLAN_EXTRA)){
        candX=p.stableTargetX513; candY=p.stableTargetY513;
      }
    }else if(roadChordLegal507(p.x,p.y,candX,candY,ROUTE_PLAN_EXTRA)){
      p.stableTargetX513=candX; p.stableTargetY513=candY; p.stableTargetUntil513=now+360;
    }
    return {x:candX,y:candY};
  }


  // v5.16 INTEGRATED CORNER + DRIVE LAYER (v5.14~v5.16)
  // v5.14: corner-entry stability
  // v5.15: corner-exit stability
  // v5.16: route planning is separated from final steering/movement shaping

  function cornerPhase516(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const next=segs[Math.min(segs.length-1,idx+1)];
    const prev=segs[Math.max(0,idx-1)];

    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const frac=s.L>0 ? along/s.L : 0;

    const nextTurn=next ? Math.abs(s.ux*next.uy-s.uy*next.ux) : 0;
    const prevTurn=prev ? Math.abs(prev.ux*s.uy-prev.uy*s.ux) : 0;

    return {
      frac,
      entering: nextTurn>.08 && frac>.68,
      exiting: prevTurn>.08 && frac<.34,
      straight: nextTurn<.055 && prevTurn<.055
    };
  }

  function stabilizeCorner516(p,si,now,tx,ty,liveEvade){
    if(liveEvade || p.controlMode!=="normal") return {x:tx,y:ty};

    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return {x:tx,y:ty};
    const phase=cornerPhase516(p,si);

    let dx=tx-p.x, dy=ty-p.y;
    let forward=dx*s.ux+dy*s.uy;
    let lateral=dx*s.nx+dy*s.ny;

    // v5.14 CORNER ENTRY:
    // once committed to a corner entry, do not make a last-second large lane swap.
    if(phase.entering){
      const currentOff=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      const commit=Math.max(-1.10,Math.min(1.10,-currentOff*.16));
      lateral=lateral*.28+commit*.72;
      lateral=Math.max(-1.25,Math.min(1.25,lateral));
      p.cornerEntryLockUntil516=now+280;
      p.cornerEntryOff516=currentOff;
    }else if(now<(p.cornerEntryLockUntil516||0) && Number.isFinite(p.cornerEntryOff516)){
      lateral=lateral*.35+(-p.cornerEntryOff516*.12)*.65;
    }

    // v5.15 CORNER EXIT:
    // immediately after a corner, preserve the exit line for a short distance instead
    // of re-centering/re-targeting across the road.
    if(phase.exiting){
      if(!Number.isFinite(p.cornerExitOff516)){
        p.cornerExitOff516=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      }
      const hold=p.cornerExitOff516;
      const desired=hold-((p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny);
      lateral=lateral*.22+desired*.78;
      lateral=Math.max(-1.05,Math.min(1.05,lateral));
      p.cornerExitHoldUntil516=now+360;
    }else if(now>=(p.cornerExitHoldUntil516||0)){
      p.cornerExitOff516=NaN;
    }

    const maxForward=Math.max(5.0,Math.min(9.0,s.L*.70));
    forward=Math.max(1.8,Math.min(maxForward,forward));

    const x=p.x+s.ux*forward+s.nx*lateral;
    const y=p.y+s.uy*forward+s.ny*lateral;
    return roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA) ? {x,y} : {x:tx,y:ty};
  }

  // v5.16 final steering layer.
  // Route/planner code may decide a desired target, but only this function converts it
  // into the local movement target used by the movement engine.
  function steeringTarget516(p,si,now,routeTarget,liveEvade){
    if(liveEvade || p.controlMode!=="normal") return routeTarget;

    const first=stabilizeTarget513(p,si,now,routeTarget.x,routeTarget.y,liveEvade);
    const second=stabilizeCorner516(p,si,now,first.x,first.y,liveEvade);
    return second;
  }


  // v5.19 INTEGRATED DIAGNOSTICS + STABILITY (v5.17~v5.19)

  function driveMode519(p,liveEvade,now){
    if(liveEvade) return "EVADE";
    if(now<(p.hardRouteLockUntil||0)) return "HARD";
    if(now<(p.routeBreakCombatUntil||0)) return "BREAK";
    if(p.controlMode && p.controlMode!=="normal") return String(p.controlMode).toUpperCase();
    return "CALM";
  }

  function recordDriveDebug519(p,si,now,routeTarget,steerTarget,moveX=0,moveY=0,liveEvade=false){
    p.debug519={
      seg:si,
      mode:driveMode519(p,liveEvade,now),
      rx:routeTarget?.x ?? p.x,
      ry:routeTarget?.y ?? p.y,
      sx:steerTarget?.x ?? p.x,
      sy:steerTarget?.y ?? p.y,
      mx:moveX,
      my:moveY,
      t:now,
      anomalies:p.anomalyCount519||0,
      source:p.routeSource523||"legacy"
    };
  }

  function detectAnomaly519(p,si,now,tx,ty,moveX,moveY){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return;

    const dx=tx-p.x, dy=ty-p.y;
    const targetDist=Math.hypot(dx,dy);
    const lateralTarget=Math.abs(dx*s.nx+dy*s.ny);
    const lateralMove=Math.abs(moveX*s.nx+moveY*s.ny);

    let reason="";
    if(targetDist>13.5) reason="FAR_TARGET";
    else if(lateralTarget>2.4) reason="WIDE_TARGET";
    else if(lateralMove>.82) reason="WIDE_MOVE";

    const prev=p.lastMoveSign519||0;
    const cur=Math.abs(lateralMove)>.12 ? Math.sign(moveX*s.nx+moveY*s.ny) : 0;
    if(!reason && prev && cur && prev!==cur && now-(p.lastMoveFlip519||0)<420){
      reason="RAPID_FLIP";
    }

    if(cur && prev && cur!==prev) p.lastMoveFlip519=now;
    if(cur) p.lastMoveSign519=cur;

    if(reason){
      p.anomalyCount519=(p.anomalyCount519||0)+1;
      p.lastAnomaly519={reason,seg:si,x:p.x,y:p.y,tx,ty,t:now};
      p.anomalyUntil519=now+900;
    }
  }


  function drawDebugHud519(ctx){
    const p=players && players.length ? players[0] : null;
    if(!p || !p.debug519) return;
    const d=p.debug519;
    ctx.save();
    ctx.globalAlpha=.90;
    ctx.fillStyle="rgba(0,0,0,.68)";
    ctx.fillRect(8,8,260,92);
    ctx.fillStyle="#fff";
    ctx.font="12px monospace";
    ctx.textBaseline="top";
    ctx.fillText("v5.19 DRIVE DEBUG",16,14);
    ctx.fillText("P1 seg "+d.seg+" "+d.mode+"  "+d.source,16,31);
    ctx.fillText("route "+d.rx.toFixed(1)+","+d.ry.toFixed(1),16,48);
    ctx.fillText("steer "+d.sx.toFixed(1)+","+d.sy.toFixed(1),16,64);
    ctx.fillText("move  "+d.mx.toFixed(2)+","+d.my.toFixed(2),16,80);
    if((p.anomalyUntil519||0)>performance.now() && p.lastAnomaly519){
      ctx.fillStyle="#ffdf6b";
      ctx.fillText("! "+p.lastAnomaly519.reason,178,31);
    }
    ctx.restore();
  }


  // v5.23 RACING LINE 3.0 PHASE 1 (v5.20~v5.23)

  // v5.20: treat the road as a drivable corridor, not as a single reference line.
  function corridorBounds520(si){
    const idx=Math.max(0,Math.min(widths.length-1,si));
    const half=Math.max(1.6,widths[idx]*ROAD_MARGIN*.94);
    return {min:-half,max:half,half};
  }

  function corridorPoint520(si,t,off){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const clampedT=Math.max(0,Math.min(1,t));
    const b=corridorBounds520(idx);
    const o=Math.max(b.min,Math.min(b.max,off));
    return {
      x:s.a[0]+s.dx*clampedT+s.nx*o,
      y:s.a[1]+s.dy*clampedT+s.ny*o
    };
  }

  // v5.21: shortest legal line across the full corridor on straight-ish sections.
  function shortestStraightTarget521(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const next=segs[Math.min(segs.length-1,idx+1)];
    if(!s) return null;

    const turn=next ? Math.abs(s.ux*next.uy-s.uy*next.ux) : 0;
    if(turn>.060) return null;

    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const currentOff=rx*s.nx+ry*s.ny;

    // Preserve the current fast lane instead of forcing a centerline.
    // Search several forward distances and only gently reduce offset.
    const targetOff=currentOff*.86;
    const distances=[9.0,7.5,6.0,4.5];
    for(const d of distances){
      const ahead=Math.min(s.L,along+d);
      const t=s.L>0 ? ahead/s.L : 1;
      const q=corridorPoint520(idx,t,targetOff);
      if(roadChordLegal507(p.x,p.y,q.x,q.y,ROUTE_PLAN_EXTRA)){
        return {...q,kind:"straight-shortest-521"};
      }
    }
    return null;
  }

  function signedTurn522(si){
    const idx=Math.max(0,Math.min(segs.length-2,si));
    const a=segs[idx], b=segs[idx+1];
    return a.ux*b.uy-a.uy*b.ux;
  }

  // v5.22: automatic apex point based on actual corner direction and corridor width.
  function autoApex522(si){
    const idx=Math.max(0,Math.min(segs.length-2,si));
    const s=segs[idx], next=segs[idx+1];
    const turn=signedTurn522(idx);
    const mag=Math.abs(turn);
    if(mag<.055) return null;

    const b=corridorBounds520(idx);
    // Apex is on the inside of the corner but slightly inset from the absolute edge.
    const insideSign=turn>0 ? 1 : -1;
    const strength=Math.max(.52,Math.min(.84,.54+mag*.52));
    const apexOff=insideSign*b.half*strength;

    // Apex slightly before the segment endpoint to avoid point-to-point L turns.
    const q=corridorPoint520(idx,.86,apexOff);
    return {
      x:q.x,y:q.y,
      off:apexOff,
      turn,
      strength,
      kind:"auto-apex-522"
    };
  }

  // v5.23: entry -> apex -> exit as one continuous target, not separate jumps.
  function continuousCornerTarget523(p,si){
    const idx=Math.max(0,Math.min(segs.length-2,si));
    const s=segs[idx], next=segs[idx+1];
    const apex=autoApex522(idx);
    if(!apex) return null;

    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const frac=s.L>0 ? along/s.L : 0;

    const nextBounds=corridorBounds520(idx+1);
    const exitOff=apex.turn>0
      ? Math.max(nextBounds.min,Math.min(nextBounds.max,apex.off*.42))
      : Math.max(nextBounds.min,Math.min(nextBounds.max,apex.off*.42));
    const exitPoint=corridorPoint520(idx+1,.52,exitOff);

    // Entry point: a mild setup, never a full-road outside swing.
    const entryOff=apex.off*-.24;
    const entryPoint=corridorPoint520(idx,Math.max(frac+.10,.58),entryOff);

    let target;
    if(frac<.62){
      // Smoothly blend entry setup toward apex.
      const u=Math.max(0,Math.min(1,(frac-.28)/.34));
      target={
        x:entryPoint.x*(1-u)+apex.x*u,
        y:entryPoint.y*(1-u)+apex.y*u
      };
    }else{
      // Smoothly blend apex into the next-segment exit.
      const u=Math.max(0,Math.min(1,(frac-.62)/.38));
      target={
        x:apex.x*(1-u)+exitPoint.x*u,
        y:apex.y*(1-u)+exitPoint.y*u
      };
    }

    if(roadChordLegal507(p.x,p.y,target.x,target.y,ROUTE_PLAN_EXTRA)){
      return {...target,kind:"entry-apex-exit-523"};
    }

    if(roadChordLegal507(p.x,p.y,apex.x,apex.y,ROUTE_PLAN_EXTRA)){
      return apex;
    }
    return null;
  }

  function racingLine523(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const corner=continuousCornerTarget523(p,si);
    if(corner) return corner;

    const straight=shortestStraightTarget521(p,si);
    if(straight) return straight;

    return null;
  }


  // v5.26 RACING LINE 3.0 PHASE 2 (v5.24~v5.26)

  function meaningfulCorner526(si){
    const idx=Math.max(0,Math.min(segs.length-2,si));
    const a=segs[idx], b=segs[idx+1];
    if(!a || !b) return false;
    return Math.abs(a.ux*b.uy-a.uy*b.ux)>.055;
  }

  // v5.24: connect two consecutive corners into one plan.
  function linkedTwoCorner524(p,si){
    const idx=Math.max(0,Math.min(segs.length-3,si));
    if(!meaningfulCorner526(idx) || !meaningfulCorner526(idx+1)) return null;

    const a1=autoApex522(idx);
    const a2=autoApex522(idx+1);
    if(!a1 || !a2) return null;

    const s=segs[idx];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const frac=s.L>0 ? along/s.L : 0;

    // Blend first apex toward second apex early enough to avoid a post-corner lane jump.
    const u=Math.max(0,Math.min(1,(frac-.38)/.62));
    let x=a1.x*(1-u)+a2.x*u;
    let y=a1.y*(1-u)+a2.y*u;

    // Keep it local enough for the stabilized steering layer.
    const dx=x-p.x, dy=y-p.y;
    const d=Math.hypot(dx,dy);
    if(d>10.5){
      const k=10.5/d;
      x=p.x+dx*k;
      y=p.y+dy*k;
    }

    if(roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)){
      return {x,y,kind:"linked-2corner-524"};
    }
    return null;
  }

  // v5.25: connect up to three meaningful corners.
  function linkedThreeCorner525(p,si){
    const idx=Math.max(0,Math.min(segs.length-4,si));
    if(!meaningfulCorner526(idx) ||
       !meaningfulCorner526(idx+1) ||
       !meaningfulCorner526(idx+2)) return null;

    const a1=autoApex522(idx);
    const a2=autoApex522(idx+1);
    const a3=autoApex522(idx+2);
    if(!a1 || !a2 || !a3) return null;

    const s=segs[idx];
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const frac=s.L>0 ? along/s.L : 0;

    // Quadratic-like progression through three apexes.
    const t=Math.max(0,Math.min(1,(frac-.28)/.72));
    const u=1-t;
    let x=u*u*a1.x + 2*u*t*a2.x + t*t*a3.x;
    let y=u*u*a1.y + 2*u*t*a2.y + t*t*a3.y;

    const dx=x-p.x, dy=y-p.y;
    const d=Math.hypot(dx,dy);
    if(d>10.0){
      const k=10.0/d;
      x=p.x+dx*k;
      y=p.y+dy*k;
    }

    if(roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)){
      return {x,y,kind:"linked-3corner-525"};
    }
    return null;
  }

  // v5.26: edge rows stay fully legal and selectable.
  // They are neither forbidden nor the default; candidate scoring decides.
  function edgeAwareCandidate526(si,t,baseOff){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const b=corridorBounds520(idx);
    const candidates=[
      baseOff,
      baseOff*.72,
      0,
      b.min*.90,
      b.max*.90
    ];

    const pts=[];
    for(const off of candidates){
      const q=corridorPoint520(idx,t,off);
      pts.push({x:q.x,y:q.y,off});
    }
    return pts;
  }

  function edgeAwareStraight526(p,si){
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];
    const next=segs[Math.min(segs.length-1,idx+1)];
    if(!s) return null;
    const turn=next ? Math.abs(s.ux*next.uy-s.uy*next.ux) : 0;
    if(turn>.060) return null;

    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const currentOff=rx*s.nx+ry*s.ny;
    const ahead=Math.min(s.L,along+8.0);
    const t=s.L>0 ? ahead/s.L : 1;

    let best=null, bestScore=Infinity;
    for(const q of edgeAwareCandidate526(idx,t,currentOff*.88)){
      if(!roadChordLegal507(p.x,p.y,q.x,q.y,ROUTE_PLAN_EXTRA)) continue;
      const d=Math.hypot(q.x-p.x,q.y-p.y);
      const laneChange=Math.abs(q.off-currentOff);
      const edgePenalty=(Math.abs(q.off)>corridorBounds520(idx).half*.82) ? .18 : 0;
      const score=d + laneChange*.38 + edgePenalty;
      if(score<bestScore){
        bestScore=score;
        best={...q,kind:"edge-aware-straight-526"};
      }
    }
    return best;
  }

  function racingLine526(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const three=linkedThreeCorner525(p,si);
    if(three) return three;

    const two=linkedTwoCorner524(p,si);
    if(two) return two;

    const corner=continuousCornerTarget523(p,si);
    if(corner) return corner;

    const straight=edgeAwareStraight526(p,si);
    if(straight) return straight;

    return shortestStraightTarget521(p,si);
  }


  // v5.29 RACING LINE 3.0 FINAL (v5.27~v5.29)

  // v5.27: search the fastest legal inside-line candidate around the next corner.
  function fastInsideLine527(p,si){
    const idx=Math.max(0,Math.min(segs.length-2,si));
    const s=segs[idx], next=segs[idx+1];
    if(!s || !next) return null;

    const turn=signedTurn522(idx);
    const mag=Math.abs(turn);
    if(mag<.050) return null;

    const b=corridorBounds520(idx);
    const insideSign=turn>0 ? 1 : -1;
    const rx=p.x-s.a[0], ry=p.y-s.a[1];
    const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
    const frac=s.L>0 ? along/s.L : 0;

    const offs=[
      insideSign*b.half*.48,
      insideSign*b.half*.62,
      insideSign*b.half*.74,
      insideSign*b.half*.86
    ];
    const ts=[
      Math.max(frac+.14,.68),
      Math.max(frac+.20,.76),
      .84,
      .90
    ];

    let best=null, bestScore=Infinity;
    for(const off of offs){
      for(const t of ts){
        const q=corridorPoint520(idx,Math.min(.94,t),off);
        if(!roadChordLegal507(p.x,p.y,q.x,q.y,ROUTE_PLAN_EXTRA)) continue;

        const d=Math.hypot(q.x-p.x,q.y-p.y);
        const edge=b.half>0 ? Math.abs(off)/b.half : 0;
        // Slightly reward a tighter legal inside line, but never enough to justify
        // a large extra travel distance.
        const score=d - edge*.22;
        if(score<bestScore){
          bestScore=score;
          best={x:q.x,y:q.y,off,kind:"fast-inside-527"};
        }
      }
    }
    return best;
  }

  // v5.28: estimate the actual short-horizon path length of a candidate.
  function estimatedPathLength528(p,si,candidate){
    if(!candidate) return Infinity;
    const idx=Math.max(0,Math.min(segs.length-1,si));
    const s=segs[idx];

    let total=Math.hypot(candidate.x-p.x,candidate.y-p.y);

    // Add a continuation term so a deceptively short first move does not win if it
    // leaves the racer badly positioned for the next road section.
    const nextIdx=Math.min(segs.length-1,idx+1);
    const next=segs[nextIdx];
    if(next && nextIdx!==idx){
      const q2=corridorPoint520(nextIdx,.46,0);
      total += Math.hypot(q2.x-candidate.x,q2.y-candidate.y)*.72;
    }

    // Penalize large lateral repositioning relative to current lane.
    if(s){
      const currentOff=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      const candOff=(candidate.x-s.a[0])*s.nx+(candidate.y-s.a[1])*s.ny;
      total += Math.abs(candOff-currentOff)*.16;
    }

    return total;
  }

  function chooseShortest529(p,si,candidates){
    let best=null, bestScore=Infinity;
    for(const c of candidates){
      if(!c) continue;
      if(!roadChordLegal507(p.x,p.y,c.x,c.y,ROUTE_PLAN_EXTRA)) continue;
      const score=estimatedPathLength528(p,si,c);
      if(score<bestScore){
        bestScore=score;
        best=c;
      }
    }
    return best;
  }

  // v5.29: final integrated Racing Line 3.0 authority.

  function insideLine604(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    const next=segs[Math.min(segs.length-1,si+1)];
    if(!s||!next) return null;
    const turn=s.ux*next.uy-s.uy*next.ux;
    if(Math.abs(turn)<.035) return null;
    const half=(widths[Math.max(0,Math.min(widths.length-1,si))]||14)*.62;
    const off=(turn>0?1:-1)*half*.92;
    const forward=Math.max(4.0,Math.min(6.5,s.L*.34));
    const x=p.x+s.ux*forward+s.nx*off;
    const y=p.y+s.uy*forward+s.ny*off;
    if(!courseContainsPoint(x,y,0.05)) return null;
    if(!roadChordLegal507(p.x,p.y,x,y,ROUTE_PLAN_EXTRA)) return null;
    return {x,y,kind:"inside-line-604"};
  }


  // ============================================================
  // v6.10 integrated AI core (v6.07 ~ v6.10)
  // ============================================================
  function mapAwareGeometry610(si){
    si=Math.max(0,Math.min(segs.length-1,si|0));
    const s=segs[si];
    const prev=segs[Math.max(0,si-1)]||s;
    const next=segs[Math.min(segs.length-1,si+1)]||s;
    const turnIn=prev.ux*s.uy-prev.uy*s.ux;
    const turnOut=s.ux*next.uy-s.uy*next.ux;
    const straight=Math.abs(turnOut)<0.035;
    return {s,prev,next,turnIn,turnOut,straight};
  }

  function legalRoadTarget608(p,t){
    if(!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) return null;
    // Planning targets must remain on the actual S-road.
    if(!courseContainsPoint(t.x,t.y,0.05)) return null;
    if(!lineStaysOnCourse(p.x,p.y,t.x,t.y,0.08)) return null;
    return t;
  }

  function straightStable609(p,si,now){
    if(p.controlMode!=="normal") return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const g=mapAwareGeometry610(si);
    if(!g.straight) return null;

    const s=g.s;
    const along=((p.x-s.a[0])*s.dx+(p.y-s.a[1])*s.dy)/(s.L*s.L);
    const remain=Math.max(0,s.L*(1-Math.max(0,Math.min(1,along))));
    if(remain<5.5) return null;

    // Project current position to this straight and keep lateral motion small.
    const lateral=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
    const desired=lateral*0.22;
    const look=Math.min(9.0,Math.max(5.0,remain*0.42));
    const x=p.x+s.ux*look+s.nx*(desired-lateral);
    const y=p.y+s.uy*look+s.ny*(desired-lateral);
    return legalRoadTarget608(p,{x,y,kind:"straight-stable-609"});
  }

  function cornerPhase610(p,si,now){
    const g=mapAwareGeometry610(si);
    const s=g.s, next=g.next;
    if(!next || Math.abs(g.turnOut)<0.035) return {phase:"straight",turn:0,dist:Infinity};

    const along=((p.x-s.a[0])*s.dx+(p.y-s.a[1])*s.dy)/(s.L*s.L);
    const remain=Math.max(0,s.L*(1-Math.max(0,Math.min(1,along))));
    let phase="approach";
    if(remain<=7.0) phase="entry";
    if(remain<=3.4) phase="apex";
    return {phase,turn:g.turnOut,dist:remain};
  }

  function cornerAware610(p,si,now){
    if(p.controlMode!=="normal") return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const c=cornerPhase610(p,si,now);
    if(c.phase==="straight") return null;

    const s=segs[si], next=segs[Math.min(segs.length-1,si+1)];
    const half=(widths[si]||14)*0.62;
    const inside=(c.turn>0?1:-1)*half;
    let forward=5.5, off=inside*0.48;
    if(c.phase==="entry"){ forward=Math.max(2.8,c.dist); off=inside*0.72; }
    if(c.phase==="apex"){ forward=Math.max(1.8,c.dist); off=inside*0.90; }

    let x=p.x+s.ux*forward+s.nx*off;
    let y=p.y+s.uy*forward+s.ny*off;

    // Near apex, blend toward the next straight so the target never jumps outside.
    if(c.phase==="apex" && next){
      const nx=s.b[0]+next.ux*3.8+next.nx*inside*0.34;
      const ny=s.b[1]+next.uy*3.8+next.ny*inside*0.34;
      x=x*0.38+nx*0.62; y=y*0.38+ny*0.62;
    }
    return legalRoadTarget608(p,{x,y,kind:"corner-aware-610-"+c.phase});
  }

  function integratedAI610(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const corner=cornerAware610(p,si,now);
    if(corner) return corner;
    const straight=straightStable609(p,si,now);
    if(straight) return straight;
    return null;
  }


  // ============================================================
  // v6.15 Racing Line 4.0 integrated core (v6.11 ~ v6.15)
  // 6.11 corner entry discipline
  // 6.12 inside apex precision
  // 6.13 corner exit alignment
  // 6.14 two-corner lookahead
  // 6.15 Racing Line 4.0 integration
  // ============================================================

  function cornerEntry611(p,si,now){
    if(p.controlMode!=="normal") return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const c=cornerPhase610(p,si,now);
    if(c.phase!=="approach" && c.phase!=="entry") return null;

    const s=segs[si], next=segs[Math.min(segs.length-1,si+1)];
    if(!s || !next || Math.abs(c.turn)<0.035) return null;

    // Stay disciplined before turn: no unnecessary sweep to the opposite side.
    const half=(widths[si]||14)*0.60;
    const inside=(c.turn>0?1:-1)*half;
    const along=((p.x-s.a[0])*s.dx+(p.y-s.a[1])*s.dy)/(s.L*s.L);
    const remain=Math.max(0,s.L*(1-Math.max(0,Math.min(1,along))));

    let off=inside*0.30;
    if(remain<8.5) off=inside*0.48;
    if(remain<5.8) off=inside*0.62;

    const forward=Math.max(3.8,Math.min(7.5,remain*0.72));
    const x=p.x+s.ux*forward+s.nx*off;
    const y=p.y+s.uy*forward+s.ny*off;
    return legalRoadTarget608(p,{x,y,kind:"corner-entry-611"});
  }

  function apex612(p,si,now){
    if(p.controlMode!=="normal") return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const c=cornerPhase610(p,si,now);
    if(c.phase!=="entry" && c.phase!=="apex") return null;

    const s=segs[si], next=segs[Math.min(segs.length-1,si+1)];
    if(!s || !next || Math.abs(c.turn)<0.035) return null;

    const half=(widths[si]||14)*0.61;
    const inside=(c.turn>0?1:-1)*half;

    // Aim very close to the legal inside edge, but keep a safety buffer.
    const apexOff=inside*0.95;
    const bx=s.b[0], by=s.b[1];
    let x=bx+s.nx*apexOff;
    let y=by+s.ny*apexOff;

    // Slightly pull toward the next straight to avoid stopping at the apex.
    x+=next.ux*2.6;
    y+=next.uy*2.6;

    return legalRoadTarget608(p,{x,y,kind:"inside-apex-612"});
  }

  function cornerExit613(p,si,now){
    if(p.controlMode!=="normal") return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const s=segs[si];
    const next=segs[Math.min(segs.length-1,si+1)];
    const next2=segs[Math.min(segs.length-1,si+2)];
    if(!s || !next) return null;

    const turn=s.ux*next.uy-s.uy*next.ux;
    if(Math.abs(turn)<0.035) return null;

    const distToCorner=Math.hypot(p.x-s.b[0],p.y-s.b[1]);
    if(distToCorner>5.2) return null;

    const half=(widths[Math.min(widths.length-1,si+1)]||14)*0.60;
    const inside=(turn>0?1:-1)*half;
    let x=s.b[0]+next.ux*6.5+next.nx*inside*0.34;
    let y=s.b[1]+next.uy*6.5+next.ny*inside*0.34;

    // If the next segment is straight, progressively center onto it.
    if(next2){
      const t2=next.ux*next2.uy-next.uy*next2.ux;
      if(Math.abs(t2)<0.035){
        x=s.b[0]+next.ux*7.4+next.nx*inside*0.18;
        y=s.b[1]+next.uy*7.4+next.ny*inside*0.18;
      }
    }
    return legalRoadTarget608(p,{x,y,kind:"corner-exit-613"});
  }

  function futureCornerInfo614(si){
    const out=[];
    for(let k=0;k<3;k++){
      const a=segs[Math.min(segs.length-1,si+k)];
      const b=segs[Math.min(segs.length-1,si+k+1)];
      if(!a || !b) continue;
      const turn=a.ux*b.uy-a.uy*b.ux;
      if(Math.abs(turn)>=0.035) out.push({index:si+k,turn});
      if(out.length>=2) break;
    }
    return out;
  }

  function twoCornerLookahead614(p,si,now){
    if(p.controlMode!=="normal") return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const info=futureCornerInfo614(si);
    if(info.length<2) return null;

    const first=info[0], second=info[1];
    const s=segs[first.index];
    const next=segs[Math.min(segs.length-1,first.index+1)];
    if(!s || !next) return null;

    const dist=Math.hypot(p.x-s.b[0],p.y-s.b[1]);
    if(dist>13.0) return null;

    const half=(widths[first.index]||14)*0.58;
    const sameDir=Math.sign(first.turn)===Math.sign(second.turn);

    // Same-direction corners: stay committed to the inside.
    // Opposite-direction corners: clip first apex but avoid overcommitting
    // so the car is already positioned for the second turn.
    let factor=sameDir?0.86:0.58;
    const inside=(first.turn>0?1:-1)*half*factor;

    const x=s.b[0]+next.ux*4.6+next.nx*inside;
    const y=s.b[1]+next.uy*4.6+next.ny*inside;
    return legalRoadTarget608(p,{x,y,kind:"two-corner-lookahead-614"});
  }

  function racingLine415(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const look=twoCornerLookahead614(p,si,now);
    const apex=apex612(p,si,now);
    const exit=cornerExit613(p,si,now);
    const entry=cornerEntry611(p,si,now);
    const base610=integratedAI610(p,si,now);

    // Priority follows race phase: lookahead -> apex -> exit -> entry -> base.
    return look || apex || exit || entry || base610 || null;
  }


  // ============================================================
  // v6.19 Driving AI 4.0 (v6.16 ~ v6.19)
  // movement radius / steering / forward motion / hard road lock
  // ============================================================
  function localMotionCap616(p,si,target){
    if(!target) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return target;
    const dx=target.x-p.x, dy=target.y-p.y;
    const d=Math.hypot(dx,dy)||1;
    const maxD=6.0;
    let x=target.x,y=target.y;
    if(d>maxD){ x=p.x+dx/d*maxD; y=p.y+dy/d*maxD; }
    const lat=(x-p.x)*s.nx+(y-p.y)*s.ny;
    const maxLat=(widths[si]||14)*0.38;
    if(Math.abs(lat)>maxLat){
      const over=lat-Math.sign(lat)*maxLat;
      x-=s.nx*over; y-=s.ny*over;
    }
    return {x,y,kind:(target.kind||"target")+"-cap616"};
  }

  function steeringStable617(p,si,target,now){
    if(!target) return null;
    const danger=Math.max(0,Math.min(1,p.liveEvadeDanger||0));
    if(!p._steer617) p._steer617={x:target.x,y:target.y};
    const a=0.30+danger*0.48;
    const x=p._steer617.x+(target.x-p._steer617.x)*a;
    const y=p._steer617.y+(target.y-p._steer617.y)*a;
    p._steer617={x,y};
    return {x,y,kind:(target.kind||"target")+"-smooth617"};
  }

  function minimumForward618(p,si,target){
    if(!target) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return target;
    const dx=target.x-p.x, dy=target.y-p.y;
    const f=dx*s.ux+dy*s.uy;
    if((p.liveEvadeDanger||0)<0.72 && f<1.8){
      return {...target,x:target.x+s.ux*(1.8-f),y:target.y+s.uy*(1.8-f),
        kind:(target.kind||"target")+"-forward618"};
    }
    return target;
  }

  function hardRoadClamp619(p,si,target){
    if(!target) return null;
    if(courseContainsPoint(target.x,target.y,0.00) &&
       lineStaysOnCourse(p.x,p.y,target.x,target.y,0.00)) return target;

    for(let k=10;k>=1;k--){
      const t=k/11;
      const x=p.x+(target.x-p.x)*t;
      const y=p.y+(target.y-p.y)*t;
      if(courseContainsPoint(x,y,0.00) &&
         lineStaysOnCourse(p.x,p.y,x,y,0.00))
        return {x,y,kind:(target.kind||"target")+"-road619"};
    }
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    const x=p.x+s.ux*2.4, y=p.y+s.uy*2.4;
    return courseContainsPoint(x,y,0.00)?{x,y,kind:"road-fallback619"}:null;
  }

  function insideShortest619(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    const next=segs[Math.min(segs.length-1,si+1)];
    if(!s||!next) return null;
    const turn=s.ux*next.uy-s.uy*next.ux;
    if(Math.abs(turn)<0.035) return null;
    const half=(widths[si]||14)*0.60;
    const inside=(turn>0?1:-1)*half*0.94;
    const dist=Math.hypot(p.x-s.b[0],p.y-s.b[1]);
    let x,y;
    if(dist>4.2){
      const f=Math.max(2.8,Math.min(6.0,dist*.75));
      x=p.x+s.ux*f+s.nx*inside;
      y=p.y+s.uy*f+s.ny*inside;
    } else {
      x=s.b[0]+next.ux*4.2+next.nx*inside*.34;
      y=s.b[1]+next.uy*4.2+next.ny*inside*.34;
    }
    return hardRoadClamp619(p,si,{x,y,kind:"inside-shortest619"});
  }

  function drivingAI419(p,si,now){
    if(p.controlMode!=="normal") return null;
    let t=insideShortest619(p,si,now) || racingLine415(p,si,now) || integratedAI610(p,si,now);
    if(!t) return null;
    t=localMotionCap616(p,si,t);
    t=steeringStable617(p,si,t,now);
    t=minimumForward618(p,si,t);
    return hardRoadClamp619(p,si,t);
  }

  function enforceRoadPosition619(p){
    if(courseContainsPoint(p.x,p.y,0.00)){
      p._lastLegal619={x:p.x,y:p.y};
      return;
    }
    if(p._lastLegal619){
      p.x=p._lastLegal619.x; p.y=p._lastLegal619.y;
      if(Number.isFinite(p.prevX)) p.prevX=p.x;
      if(Number.isFinite(p.prevY)) p.prevY=p.y;
      if(Number.isFinite(p.simPrevX)) p.simPrevX=p.x;
      if(Number.isFinite(p.simPrevY)) p.simPrevY=p.y;
      return;
    }
    const s=segs[Math.max(0,Math.min(segs.length-1,p.seg||0))];
    p.x=s.a[0]; p.y=s.a[1]; p._lastLegal619={x:p.x,y:p.y};
  }


  // ============================================================
  // v6.20 strict shortest-inside + corrected S-road geometry
  // ============================================================
  function strictInside620(p,si,now){
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    const next=segs[Math.min(segs.length-1,si+1)];
    if(!s||!next) return null;

    const turn=s.ux*next.uy-s.uy*next.ux;
    const along=((p.x-s.a[0])*s.dx+(p.y-s.a[1])*s.dy)/(s.L*s.L);
    const remain=Math.max(0,s.L*(1-Math.max(0,Math.min(1,along))));

    // Straight: hold the shortest forward chord, no wandering to the far side.
    if(Math.abs(turn)<0.035){
      const f=Math.max(3.2,Math.min(6.0,remain));
      return hardRoadClamp619(p,si,{
        x:p.x+s.ux*f,
        y:p.y+s.uy*f,
        kind:"strict-straight620"
      });
    }

    // Corner: hug the legal inside edge with a small safety buffer.
    const legalHalf=Math.max(2.0,(widths[si]||14)*ROAD_MARGIN);
    const insideSign=turn>0?1:-1;
    const inside=insideSign*legalHalf*0.84;

    let x,y;
    if(remain>5.0){
      const f=Math.max(3.0,Math.min(5.5,remain*.72));
      x=p.x+s.ux*f+s.nx*inside;
      y=p.y+s.uy*f+s.ny*inside;
    }else{
      // Cut across the inside of the 90-degree bend and immediately align with exit.
      x=s.b[0]+s.nx*inside*.88+next.ux*4.4+next.nx*inside*.18;
      y=s.b[1]+s.ny*inside*.88+next.uy*4.4+next.ny*inside*.18;
    }
    return hardRoadClamp619(p,si,{x,y,kind:"strict-inside620"});
  }

  function drivingAI420(p,si,now){
    let t=strictInside620(p,si,now);
    if(!t) t=drivingAI419(p,si,now);
    if(!t) return null;
    t=localMotionCap616(p,si,t);
    t=steeringStable617(p,si,t,now);
    t=minimumForward618(p,si,t);
    return hardRoadClamp619(p,si,t);
  }


  // ============================================================
  // v6.25 Observer Avoidance 3.0 phase 1 (v6.21 ~ v6.25)
  // ============================================================
  function observerThreat621(p,o){
    const rx=o.x-p.x, ry=o.y-p.y;
    const pvx=(p.x-(p.simPrevX??p.prevX??p.x))*60;
    const pvy=(p.y-(p.simPrevY??p.prevY??p.y))*60;
    const ovx=Number.isFinite(o.vx)?o.vx:0;
    const ovy=Number.isFinite(o.vy)?o.vy:0;
    const vx=ovx-pvx, vy=ovy-pvy;
    const vv=vx*vx+vy*vy;
    let t=vv>1e-6?-(rx*vx+ry*vy)/vv:999;
    t=Math.max(0,Math.min(2.2,t));
    const fx=rx+vx*t, fy=ry+vy*t;
    const miss=Math.hypot(fx,fy);
    return {o,t,miss,dist:Math.hypot(rx,ry),rx,ry};
  }

  function collisionTTC622(p){
    let best=null;
    for(const o of observers){
      const q=observerThreat621(p,o);
      if(q.t>1.65 || q.miss>3.2) continue;
      if(!best || q.t<best.t || (Math.abs(q.t-best.t)<.08 && q.miss<best.miss)) best=q;
    }
    return best;
  }

  function minimumDodge623(p,si,threat,side){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s||!threat) return null;
    const urgency=Math.max(0,Math.min(1,(1.35-threat.t)/1.35));
    const missNeed=Math.max(0,2.35-threat.miss);
    const lateral=Math.min((widths[si]||14)*0.42, 1.05+missNeed*.82+urgency*1.45);
    const forward=3.2+Math.max(0,1-urgency)*1.8;
    return {
      x:p.x+s.ux*forward+s.nx*lateral*side,
      y:p.y+s.uy*forward+s.ny*lateral*side,
      kind:"minimum-dodge623"
    };
  }

  function dodgeScore624(p,si,t,threat){
    if(!t) return Infinity;
    if(!courseContainsPoint(t.x,t.y,0.00)) return Infinity;
    if(!lineStaysOnCourse(p.x,p.y,t.x,t.y,0.00)) return Infinity;
    const d=Math.hypot(t.x-p.x,t.y-p.y);
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    const forward=(t.x-p.x)*s.ux+(t.y-p.y)*s.uy;
    let nearest=999;
    for(const o of observers){
      nearest=Math.min(nearest,Math.hypot(t.x-o.x,t.y-o.y));
    }
    return d*0.50 - forward*0.24 + Math.max(0,4.0-nearest)*2.8;
  }

  function roadSafeAvoidance625(p,si,now){
    const threat=collisionTTC622(p);
    if(!threat) return null;

    let left=minimumDodge623(p,si,threat,-1);
    let right=minimumDodge623(p,si,threat,1);
    left=hardRoadClamp619(p,si,left);
    right=hardRoadClamp619(p,si,right);

    const sl=dodgeScore624(p,si,left,threat);
    const sr=dodgeScore624(p,si,right,threat);
    let best=sl<=sr?left:right;
    if(!best || !Number.isFinite(Math.min(sl,sr))) return null;

    best=localMotionCap616(p,si,best);
    best=minimumForward618(p,si,best);
    best=hardRoadClamp619(p,si,best);
    if(best){
      best.kind="avoidance3-phase1-625";
      p.avoidance3Until625=now+260;
    }
    return best;
  }



  // ============================================================
  // v6.30 Observer Avoidance 3.0 FINAL (v6.26 ~ v6.30)
  // 6.26 multi-observer danger map
  // 6.27 safe-gap search
  // 6.28 secondary-collision prediction
  // 6.29 forward-progress preservation
  // 6.30 full Avoidance 3.0 integration
  // ============================================================

  function multiObserverRisk626(p,x,y,horizon=0.72){
    let risk=0, nearest=999, count=0;
    for(const o of observers){
      const ox=o.x, oy=o.y;
      const ovx=Number.isFinite(o.vx)?o.vx:0;
      const ovy=Number.isFinite(o.vy)?o.vy:0;
      const px=ox+ovx*horizon;
      const py=oy+ovy*horizon;
      const d=Math.hypot(x-px,y-py);
      nearest=Math.min(nearest,d);
      if(d<8.0){
        count++;
        const w=Math.max(0,(8.0-d)/8.0);
        risk+=w*w*4.0;
      }
    }
    return {risk,nearest,count};
  }

  function safeGap627(p,si,threat){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return null;
    const half=Math.max(2.2,(widths[si]||14)*0.54);
    let best=null, bestScore=Infinity;

    // Sample legal lateral gaps from strong inside to outside, but penalize detours.
    for(let j=-8;j<=8;j++){
      const off=half*(j/8);
      const forward=4.0;
      const x=p.x+s.ux*forward+s.nx*off;
      const y=p.y+s.uy*forward+s.ny*off;
      if(!courseContainsPoint(x,y,0.00)) continue;
      if(!lineStaysOnCourse(p.x,p.y,x,y,0.00)) continue;

      const r=multiObserverRisk626(p,x,y,0.62);
      const travel=Math.hypot(x-p.x,y-p.y);
      const lateral=Math.abs(off);
      // Prefer low risk, small lateral movement, and forward progress.
      const score=r.risk*5.0 + lateral*.34 + travel*.08 - forward*.16;
      if(score<bestScore){
        bestScore=score;
        best={x,y,kind:"safe-gap627",risk:r.risk,nearest:r.nearest};
      }
    }
    return best;
  }

  function secondaryCollision628(p,si,target){
    if(!target) return null;
    const steps=5;
    let worst=0;
    for(let k=1;k<=steps;k++){
      const t=k/steps;
      const x=p.x+(target.x-p.x)*t;
      const y=p.y+(target.y-p.y)*t;
      const r=multiObserverRisk626(p,x,y,t*.72);
      worst=Math.max(worst,r.risk);
      if(r.nearest<1.55) return null;
    }
    return {...target,secondaryRisk628:worst};
  }

  function preserveForward629(p,si,target){
    if(!target) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return target;
    const dx=target.x-p.x, dy=target.y-p.y;
    const forward=dx*s.ux+dy*s.uy;
    if(forward>=2.4) return target;

    const need=2.4-forward;
    const t={
      ...target,
      x:target.x+s.ux*need,
      y:target.y+s.uy*need,
      kind:(target.kind||"avoid")+"-forward629"
    };
    return hardRoadClamp619(p,si,t);
  }

  function avoidance330(p,si,now){
    const primary=collisionTTC622(p);
    if(!primary) return null;

    // Existing minimum-dodge left/right candidates.
    let left=secondaryCollision628(p,si,
      hardRoadClamp619(p,si,minimumDodge623(p,si,primary,-1)));
    let right=secondaryCollision628(p,si,
      hardRoadClamp619(p,si,minimumDodge623(p,si,primary,1)));

    // New multi-observer safe-gap candidate.
    let gap=secondaryCollision628(p,si,safeGap627(p,si,primary));

    const candidates=[left,right,gap].filter(Boolean);
    if(!candidates.length) return null;

    let best=null,bestScore=Infinity;
    for(let t of candidates){
      t=preserveForward629(p,si,t);
      t=hardRoadClamp619(p,si,t);
      if(!t) continue;
      const base=dodgeScore624(p,si,t,primary);
      const r=multiObserverRisk626(p,t.x,t.y,0.68);
      const score=base+r.risk*4.4+(t.secondaryRisk628||0)*3.2;
      if(score<bestScore){bestScore=score;best=t;}
    }
    if(!best) return null;

    best=localMotionCap616(p,si,best);
    best=minimumForward618(p,si,best);
    best=preserveForward629(p,si,best);
    best=hardRoadClamp619(p,si,best);
    if(best){
      best.kind="avoidance3-final630";
      p.avoidance3Until625=now+300;
      p.avoidance330ActiveUntil=now+300;
    }
    return best;
  }

  function forceStartCenter625(p){
    const sx=31.05, sy=132.55;
    p.x=sx; p.y=sy;
    p.prevX=sx; p.prevY=sy;
    p.simPrevX=sx; p.simPrevY=sy;
    p.lastX=sx; p.lastY=sy;
    p.mouseTargetX=sx; p.mouseTargetY=sy;
    p.seg=0;
    p.lastProgress=0;
    p._lastLegal619={x:sx,y:sy};
    p._steer617={x:sx,y:sy};
  }


  // ============================================================
  // v6.35 Survival Racing AI 4.0 (v6.31 ~ v6.35)
  // 6.31 immediate inside-line rejoin
  // 6.32 suppress over-avoidance
  // 6.33 stabilize consecutive avoidance
  // 6.34 survival/racing authority integration
  // 6.35 final Survival Racing AI 4.0
  // ============================================================

  function rejoinInside631(p,si,now){
    if(now<(p.avoidance330ActiveUntil||0)) return null;
    const last=p.avoidance3Until625||0;
    if(!last || now-last>1250) return null;
    const t=strictInside620(p,si,now);
    if(!t) return null;
    return {...t,kind:"rejoin-inside631"};
  }

  function suppressOverAvoidance632(p,si,now,target){
    if(!target) return null;
    const threat=collisionTTC622(p);
    if(threat) return target;

    // No current threat: do not continue drifting away from racing line.
    if(now>=(p.avoidance330ActiveUntil||0)){
      const rejoin=rejoinInside631(p,si,now);
      if(rejoin) return rejoin;
      return null;
    }
    return target;
  }

  function stabilizeAvoidance633(p,si,now,target){
    if(!target) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return target;

    const lat=(target.x-p.x)*s.nx+(target.y-p.y)*s.ny;
    const side=Math.sign(lat)||0;
    if(!p._avoid633) p._avoid633={side:0,until:0};

    // Prevent left-right-left oscillation unless the new side is materially safer.
    if(now<p._avoid633.until && p._avoid633.side && side && side!==p._avoid633.side){
      const hold=minimumDodge623(p,si,collisionTTC622(p),p._avoid633.side);
      const h=hardRoadClamp619(p,si,hold);
      if(h) return {...h,kind:"avoid-side-hold633"};
    }
    if(side){
      p._avoid633.side=side;
      p._avoid633.until=now+240;
    }
    return target;
  }

  function survivalRacing634(p,si,now){
    // Survival has authority only while there is a real predicted threat.
    let avoid=avoidance330(p,si,now);
    avoid=suppressOverAvoidance632(p,si,now,avoid);
    avoid=stabilizeAvoidance633(p,si,now,avoid);
    if(avoid) return avoid;

    const rejoin=rejoinInside631(p,si,now);
    if(rejoin) return rejoin;

    return drivingAI420(p,si,now);
  }

  function survivalRacingAI435(p,si,now){
    let t=survivalRacing634(p,si,now);
    if(!t) return null;

    t=localMotionCap616(p,si,t);
    t=steeringStable617(p,si,t,now);
    t=minimumForward618(p,si,t);
    t=hardRoadClamp619(p,si,t);
    return t;
  }

  // 9 o'clock -> 11 o'clock upward section protection.
  // This is the first vertical climb after the middle westbound straight.
  function westToUpperClimbGuard635(p,si,target){
    if(!target) return null;
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return target;

    // Route segment around x=44, y~74 -> y~23.5
    const onProtectedClimb =
      Math.abs(s.a[0]-44)<2.5 && Math.abs(s.b[0]-44)<2.5 &&
      Math.min(s.a[1],s.b[1])<76 && Math.max(s.a[1],s.b[1])>28;

    if(!onProtectedClimb) return target;

    // Keep target inside a conservative visible-road corridor.
    // Do not allow deep inside cutting toward scenery/non-road.
    const centerX=44.0;
    const maxInside=4.6;
    const minX=centerX-maxInside;
    const maxX=centerX+maxInside;

    let x=Math.max(minX,Math.min(maxX,target.x));
    let y=target.y;

    let guarded={...target,x,y,kind:(target.kind||"target")+"-9to11guard635"};

    // If the adjusted chord still leaves road, fall back to a short centerline climb.
    guarded=hardRoadClamp619(p,si,guarded);
    if(guarded) return guarded;

    const forward=3.6;
    const fallback={
      x:centerX,
      y:p.y+s.uy*forward,
      kind:"9to11-center-fallback635"
    };
    return hardRoadClamp619(p,si,fallback);
  }


  function enforceProtectedClimb635(p){
    const si=Math.max(0,Math.min(segs.length-1,p.seg||0));
    const s=segs[si];
    if(!s) return;
    const onProtectedClimb =
      Math.abs(s.a[0]-44)<2.5 && Math.abs(s.b[0]-44)<2.5 &&
      Math.min(s.a[1],s.b[1])<76 && Math.max(s.a[1],s.b[1])>28;
    if(!onProtectedClimb) return;

    const minX=39.4, maxX=48.6;
    if(p.x<minX) p.x=minX;
    if(p.x>maxX) p.x=maxX;

    // Keep only if still legal; otherwise fall back to last legal road point.
    if(!courseContainsPoint(p.x,p.y,0.00) && p._lastLegal619){
      p.x=p._lastLegal619.x;
      p.y=p._lastLegal619.y;
    }
  }


  // ============================================================
  // v6.36 CORE RULE AUDIT
  // Consolidates the project's non-negotiable rules:
  // - exact yellow-zone center start
  // - auto camera always follows the actual live P1
  // - player-player bodies are non-solid
  // - no rank/speed rubber-band
  // - calm racing = shortest legal road line
  // - avoidance = local/minimum deviation only
  // - physical position may never remain outside the legal road
  // ============================================================

  function finalRoadTarget636(p,si,target){
    if(!target) return null;
    let t=hardRoadClamp619(p,si,target);
    if(!t){
      const s=segs[Math.max(0,Math.min(segs.length-1,si))];
      if(!s) return null;
      t={x:p.x+s.ux*2.2,y:p.y+s.uy*2.2,kind:"core-forward636"};
      t=hardRoadClamp619(p,si,t);
    }
    return t;
  }

  function enforcePhysicalRoad636(p){
    // The old order allowed OUTSIDE death before road containment ran.
    // v6.36 makes containment authoritative immediately after movement.
    if(courseContainsPoint(p.x,p.y,0.00)){
      p._lastLegal636={x:p.x,y:p.y};
      p._lastLegal619={x:p.x,y:p.y};
      return true;
    }

    const si=Math.max(0,Math.min(segs.length-1,p.seg||0));
    const s=segs[si];

    // First try projection onto the current route segment center corridor.
    if(s){
      const rx=p.x-s.a[0], ry=p.y-s.a[1];
      const along=Math.max(0,Math.min(s.L,rx*s.ux+ry*s.uy));
      const lateral=rx*s.nx+ry*s.ny;
      const half=Math.max(1.8,(widths[si]||14)*ROAD_MARGIN*.94);
      const clampedLat=Math.max(-half,Math.min(half,lateral));
      const x=s.a[0]+s.ux*along+s.nx*clampedLat;
      const y=s.a[1]+s.uy*along+s.ny*clampedLat;
      if(courseContainsPoint(x,y,0.00)){
        p.x=x;p.y=y;
        p._lastLegal636={x,y};
        p._lastLegal619={x,y};
        return true;
      }
    }

    // Then restore the most recent legal position.
    const last=p._lastLegal636||p._lastLegal619;
    if(last && courseContainsPoint(last.x,last.y,0.00)){
      p.x=last.x;p.y=last.y;
      return true;
    }

    // Absolute fallback: yellow start-zone center.
    p.x=31.05;p.y=132.55;
    p.seg=0;
    p._lastLegal636={x:p.x,y:p.y};
    p._lastLegal619={x:p.x,y:p.y};
    return true;
  }


  // ============================================================
  // v6.44 Racecraft 3.0 (v6.37 ~ v6.44)
  // ============================================================
  function frontRacer637(p,si){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return null;
    let best=null;
    const pp=currentProgress(p);
    for(const q of players){
      if(q===p||q.dead||q.done) continue;
      const dx=q.x-p.x, dy=q.y-p.y;
      const f=dx*s.ux+dy*s.uy;
      const l=Math.abs(dx*s.nx+dy*s.ny);
      if(f<=0.15||f>16||l>6) continue;
      if(currentProgress(q)+0.10<pp) continue;
      const cand={q,forward:f,lateral:l};
      if(!best||f<best.forward) best=cand;
    }
    return best;
  }

  function trafficSideScore638(p,si,side,front){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return Infinity;
    const half=Math.max(2.4,(widths[si]||14)*0.48);
    const off=half*0.72*side;
    const forward=Math.max(4.8,Math.min(9.0,(front?.forward||6.5)+2.6));
    const t=finalRoadTarget636(p,si,{
      x:p.x+s.ux*forward+s.nx*off,
      y:p.y+s.uy*forward+s.ny*off,
      kind:"overtake-space638"
    });
    if(!t) return Infinity;

    let score=0;
    for(const q of players){
      if(q===p||q.dead||q.done) continue;
      const d=Math.hypot(t.x-q.x,t.y-q.y);
      if(d<2.4) score+=12;
      else if(d<4.2) score+=4.5;
    }
    score+=multiObserverRisk626(p,t.x,t.y,0.55).risk*3.5;
    score+=Math.abs(off)*0.30;
    return score;
  }

  function overtakeSpace638(p,si,front){
    if(!front) return null;
    const l=trafficSideScore638(p,si,-1,front);
    const r=trafficSideScore638(p,si,1,front);
    if(!Number.isFinite(l)&&!Number.isFinite(r)) return null;
    return l<=r?{side:-1,score:l}:{side:1,score:r};
  }

  function overtakeCost639(p,si,front,space){
    if(!front||!space) return {worth:false,cost:Infinity,gain:0};
    const my=p._frameSpeed||p.speed||0;
    const his=front.q._frameSpeed||front.q.speed||0;
    const closing=Math.max(0,my-his);
    const gain=closing*1.9+Math.max(0,5.5-front.forward)*0.22;
    const half=Math.max(2.4,(widths[si]||14)*0.48);
    const extra=Math.abs(half*0.72)*0.78+0.55;
    const cost=extra*0.42+space.score*0.18;
    return {worth:gain>cost*0.92,cost,gain};
  }

  function insideOvertakeSide640(p,si,space){
    if(!space) return null;
    const a=segs[Math.max(0,Math.min(segs.length-1,si))];
    const b=segs[Math.max(0,Math.min(segs.length-1,si+1))];
    if(!a||!b) return space.side;
    const turn=a.ux*b.uy-a.uy*b.ux;
    if(Math.abs(turn)<0.15) return space.side;
    const inside=turn>0?1:-1;
    const front=frontRacer637(p,si);
    const siScore=trafficSideScore638(p,si,inside,front);
    const soScore=trafficSideScore638(p,si,-inside,front);
    return Number.isFinite(siScore)&&siScore<=soScore+2.4?inside:space.side;
  }

  function shouldAbortOvertake641(p,si,front,space,cost){
    if(!front||!space||!cost||!cost.worth) return true;
    if(front.forward<1.7) return true;
    if(space.score>11.0) return true;
    return false;
  }

  function overtakeTarget642(p,si,front,side){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s||!front||!side) return null;
    const half=Math.max(2.4,(widths[si]||14)*0.48);
    const off=half*0.66*side;
    const forward=Math.max(5.5,Math.min(9.5,front.forward+3.0));
    return finalRoadTarget636(p,si,{
      x:p.x+s.ux*forward+s.nx*off,
      y:p.y+s.uy*forward+s.ny*off,
      kind:"overtake642"
    });
  }

  function rejoinAfterPass642(p,si,now){
    const until=p._overtake642Until||0;
    if(!until||now<until||now-until>1200) return null;
    const front=frontRacer637(p,si);
    if(front&&front.forward<3.0) return null;
    const t=strictInside620(p,si,now);
    return t?{...t,kind:"overtake-rejoin642"}:null;
  }

  function multiRacerTraffic643(p,si,now){
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return null;
    const near=[];
    for(const q of players){
      if(q===p||q.dead||q.done) continue;
      const dx=q.x-p.x,dy=q.y-p.y;
      const f=dx*s.ux+dy*s.uy,l=dx*s.nx+dy*s.ny;
      if(f>-1.5&&f<13.5&&Math.abs(l)<7.5) near.push({q,f,l});
    }
    if(near.length<2) return null;

    const half=Math.max(2.4,(widths[si]||14)*0.48);
    let best=null,bestScore=Infinity;
    for(const k of [-0.78,-0.50,-0.24,0,0.24,0.50,0.78]){
      const off=half*k,forward=6.2;
      const t=finalRoadTarget636(p,si,{
        x:p.x+s.ux*forward+s.nx*off,
        y:p.y+s.uy*forward+s.ny*off,
        kind:"multi-traffic643"
      });
      if(!t) continue;
      let score=Math.abs(off)*0.24;
      for(const n of near){
        const d=Math.hypot(t.x-n.q.x,t.y-n.q.y);
        if(d<2.2) score+=20;
        else if(d<3.8) score+=7;
        else if(d<5) score+=2;
      }
      score+=multiObserverRisk626(p,t.x,t.y,0.52).risk*3.2;
      const inside=strictInside620(p,si,now);
      if(inside) score+=Math.hypot(t.x-inside.x,t.y-inside.y)*0.07;
      if(score<bestScore){bestScore=score;best=t;}
    }
    return bestScore<14?best:null;
  }

  function racecraft344(p,si,now){
    if(collisionTTC622(p)) return null;

    const rejoin=rejoinAfterPass642(p,si,now);
    if(rejoin) return rejoin;

    const multi=multiRacerTraffic643(p,si,now);
    if(multi) return multi;

    const front=frontRacer637(p,si);
    if(!front) return null;
    const space=overtakeSpace638(p,si,front);
    if(!space) return null;
    const cost=overtakeCost639(p,si,front,space);
    if(shouldAbortOvertake641(p,si,front,space,cost)) return null;

    const abilityPass655=overtakeSkill655(p,si,front,space,cost);
    if(!abilityPass655.allow) return null;

    const side=insideOvertakeSide640(p,si,space);
    const target=overtakeTarget642(p,si,front,side);
    if(!target) return null;

    p._overtake642Until=now+420;
    p._overtake642TargetId=front.q.index;
    return {...target,kind:"racecraft3-644"};
  }


  // ============================================================
  // v6.56 Driver Ability 3.0 (v6.45 ~ v6.56)
  // ============================================================

  function driverAbilityBase645(p){
    // Stable deterministic defaults from player index.
    // Existing player speed remains untouched: ability changes execution quality,
    // not macro route choice or rubber-band speed.
    if(!p._ability645){
      const i=(p.index||0);
      const seeds=[0.88,0.82,0.76,0.71,0.66,0.61,0.56,0.51];
      const base=seeds[i%seeds.length]||0.65;
      p._ability645={
        line:Math.max(.45,Math.min(.96,base+.05)),
        reaction:Math.max(.45,Math.min(.96,base+.02)),
        judgment:Math.max(.45,Math.min(.96,base+.01)),
        stability:Math.max(.45,Math.min(.96,base+.04)),
        aggression:Math.max(.30,Math.min(.92,.48+(i%4)*.10)),
        risk:Math.max(.30,Math.min(.90,.42+((i*3)%5)*.08)),
        composure:Math.max(.45,Math.min(.96,base+.03)),
        corner:Math.max(.45,Math.min(.96,base+.05)),
        straight:Math.max(.45,Math.min(.96,base+.02)),
        avoidance:Math.max(.45,Math.min(.96,base+.01)),
        overtake:Math.max(.45,Math.min(.96,base))
      };
    }
    return p._ability645;
  }

  function lineAccuracy645(p,si,target){
    if(!target) return null;
    const a=driverAbilityBase645(p);
    const s=segs[Math.max(0,Math.min(segs.length-1,si))];
    if(!s) return target;

    // Lower skill creates only tiny local execution error inside the same legal corridor.
    const maxErr=(1-a.line)*0.70;
    const phase=((p.index||0)*1.37+(p.lastProgress||0)*0.19);
    const err=Math.sin(phase)*maxErr;
    let t={...target,x:target.x+s.nx*err,y:target.y+s.ny*err,kind:(target.kind||"target")+"-line645"};
    return finalRoadTarget636(p,si,t);
  }

  function reactionDelay646(p,now,kind){
    const a=driverAbilityBase645(p);
    if(!p._reaction646) p._reaction646={};
    const key=kind||"general";
    const minDelay=35, maxDelay=175;
    const delay=minDelay+(1-a.reaction)*(maxDelay-minDelay);
    const last=p._reaction646[key]||0;
    if(now-last<delay) return false;
    p._reaction646[key]=now;
    return true;
  }

  function judgmentQuality647(p,choices){
    const a=driverAbilityBase645(p);
    if(!choices||!choices.length) return null;
    const ranked=choices.filter(Boolean).sort((x,y)=>(x.score??Infinity)-(y.score??Infinity));
    if(!ranked.length) return null;
    if(ranked.length===1) return ranked[0];

    // Weak drivers may choose the second-best legal option, never an illegal macro route.
    const wobble=(1-a.judgment)*0.34;
    const r=Math.abs(Math.sin((p.index||0)*2.17+(p.lastProgress||0)*0.11));
    return r<wobble?ranked[Math.min(1,ranked.length-1)]:ranked[0];
  }

  function stability648(p,si,target,now){
    if(!target) return null;
    const a=driverAbilityBase645(p);
    if(!p._stab648) p._stab648={x:target.x,y:target.y,t:now};

    const blend=.58+a.stability*.34;
    const x=p._stab648.x+(target.x-p._stab648.x)*blend;
    const y=p._stab648.y+(target.y-p._stab648.y)*blend;
    p._stab648={x,y,t:now};

    return finalRoadTarget636(p,si,{...target,x,y,kind:(target.kind||"target")+"-stable648"});
  }

  function aggression649(p){
    return driverAbilityBase645(p).aggression;
  }

  function riskTolerance650(p){
    return driverAbilityBase645(p).risk;
  }

  function composure651(p){
    return driverAbilityBase645(p).composure;
  }

  function cornerSkill652(p,si,target){
    if(!target) return null;
    const a=driverAbilityBase645(p);
    const s0=segs[Math.max(0,Math.min(segs.length-1,si))];
    const s1=segs[Math.max(0,Math.min(segs.length-1,si+1))];
    if(!s0||!s1) return target;
    const turn=s0.ux*s1.uy-s0.uy*s1.ux;
    if(Math.abs(turn)<0.12) return target;

    // Better corner drivers commit more precisely to the legal inside target.
    const ideal=strictInside620(p,si,gameNow());
    if(!ideal) return target;
    const w=.30+a.corner*.55;
    return finalRoadTarget636(p,si,{
      ...target,
      x:target.x*(1-w)+ideal.x*w,
      y:target.y*(1-w)+ideal.y*w,
      kind:(target.kind||"target")+"-corner652"
    });
  }

  function straightSkill653(p,si,target){
    if(!target) return null;
    const a=driverAbilityBase645(p);
    const s0=segs[Math.max(0,Math.min(segs.length-1,si))];
    const s1=segs[Math.max(0,Math.min(segs.length-1,si+1))];
    if(!s0) return target;
    const turn=s1?(s0.ux*s1.uy-s0.uy*s1.ux):0;
    if(Math.abs(turn)>=0.12) return target;

    // Strong straight driver reduces pointless lateral motion.
    const rx=target.x-p.x, ry=target.y-p.y;
    const f=rx*s0.ux+ry*s0.uy;
    const l=rx*s0.nx+ry*s0.ny;
    const l2=l*(1-(a.straight*.72));
    return finalRoadTarget636(p,si,{
      ...target,
      x:p.x+s0.ux*f+s0.nx*l2,
      y:p.y+s0.uy*f+s0.ny*l2,
      kind:(target.kind||"target")+"-straight653"
    });
  }

  function avoidanceSkill654(p,si,now,target){
    if(!target) return null;
    const a=driverAbilityBase645(p);

    // High avoidance skill = closer to minimum required dodge and faster rejoin.
    const min=minimumForward618(p,si,target);
    if(!min) return target;
    const w=.42+a.avoidance*.50;
    return finalRoadTarget636(p,si,{
      ...target,
      x:target.x*(1-w)+min.x*w,
      y:target.y*(1-w)+min.y*w,
      kind:(target.kind||"target")+"-avoid654"
    });
  }

  function overtakeSkill655(p,si,front,space,costInfo){
    const a=driverAbilityBase645(p);
    if(!front||!space||!costInfo) return {allow:false};

    const pd=personalityDecision658(p,"overtake");
    const aggression=Math.max(0,Math.min(1,(aggression649(p)*.55)+(pd.aggression*.45)));
    const risk=Math.max(0,Math.min(1,(riskTolerance650(p)*.55)+(pd.risk*.45)));
    const quality=a.overtake;

    // Better/aggressive drivers accept smaller positive margins; weak/stable drivers wait.
    // Personality changes commitment only; target geometry is still handled by shortest-line guards.
    const threshold=1.20-(quality*.22)-(aggression*.10)-(risk*.06)+(pd.patience*.035);
    const allow=costInfo.gain>costInfo.cost*threshold && space.score<(9.2+risk*3.1);
    return {allow,threshold};
  }

  function driverAbility356(p,si,now,target,mode){
    if(!target) return null;
    let t=target;

    if(mode==="avoid"){
      if(reactionDelay646(p,now,"avoid")) t=avoidanceSkill654(p,si,now,t);
    }else{
      t=cornerSkill652(p,si,t);
      t=straightSkill653(p,si,t);
    }

    t=lineAccuracy645(p,si,t);
    t=stability648(p,si,t,now);
    return finalRoadTarget636(p,si,t);
  }


  // ============================================================
  // v6.69 Race AI 7.0 FINAL (v6.57 ~ v6.69)
  // ============================================================

  function driverPersonality357(p){
    if(!p._personality657){
      const profiles=[
        {name:"balanced", aggression:0.56, risk:0.48, patience:0.62, commitment:0.62},
        {name:"attacker", aggression:0.80, risk:0.66, patience:0.40, commitment:0.78},
        {name:"stable", aggression:0.40, risk:0.34, patience:0.80, commitment:0.54},
        {name:"opportunist", aggression:0.68, risk:0.52, patience:0.58, commitment:0.70},
        {name:"balanced", aggression:0.58, risk:0.46, patience:0.66, commitment:0.64},
        {name:"attacker", aggression:0.76, risk:0.62, patience:0.44, commitment:0.75},
        {name:"stable", aggression:0.38, risk:0.31, patience:0.84, commitment:0.52},
        {name:"opportunist", aggression:0.64, risk:0.49, patience:0.61, commitment:0.68}
      ];
      p._personality657={...profiles[(p.index||0)%profiles.length]};
    }
    return p._personality657;
  }

  function personalityDecision658(p,kind){
    const ps=driverPersonality357(p);
    // Personality affects decision timing/commitment only. It never creates a route offset.
    if(kind==="overtake") return {aggression:ps.aggression,risk:ps.risk,patience:ps.patience,commitment:ps.commitment};
    if(kind==="avoid") return {risk:Math.min(.72,ps.risk),commitment:Math.max(.56,ps.commitment)};
    return {commitment:ps.commitment,patience:ps.patience};
  }

  function preventSlowMacroRoute659(p,si,now,target,threat){
    if(!target) return null;
    let t=finalRoadTarget636(p,si,target);
    if(!t) return null;
    if(threat) return t; // survival is allowed to spend distance when required.

    const ideal=strictInside620(p,si,now);
    if(!ideal) return t;
    const idealSafe=finalRoadTarget636(p,si,ideal);
    if(!idealSafe) return t;

    const lt=estimatedPathLength528(p,si,t);
    const li=estimatedPathLength528(p,si,idealSafe);
    // Personality/ability cannot knowingly choose a materially slower macro line.
    if(Number.isFinite(lt)&&Number.isFinite(li)&&lt>li+0.82){
      return {...idealSafe,kind:"macro-shortest659"};
    }
    return t;
  }

  function executionDifference660(p,si,now,target,threat){
    if(!target) return null;
    // Skill differences are expressed as precision/reaction/judgment, never raw catch-up speed.
    let t=driverAbility356(p,si,now,target,threat?"avoid":"race");
    return preventSlowMacroRoute659(p,si,now,t,threat);
  }

  let raceFrameCache668={stamp:-1,active:[],leader:null,top:[]};
  function rebuildRaceFrameCache668(now){
    const active=[];
    for(const p of players){
      if(p.done||p.dead) continue;
      active.push({p,prog:currentProgress(p)});
    }
    active.sort((a,b)=>b.prog-a.prog);
    raceFrameCache668={stamp:now,active,leader:active[0]?.p||null,top:active.slice(0,4)};
    return raceFrameCache668;
  }

  function cameraSubject661(now){
    const cache=(raceFrameCache668.stamp===now)?raceFrameCache668:rebuildRaceFrameCache668(now);
    return cache.leader;
  }

  function closeBattleFrame662(leader,cache){
    if(!leader||!cache||cache.active.length<2) return {x:leader?.x||camX,y:leader?.y||camY,weight:1};
    const second=cache.active[1];
    const first=cache.active[0];
    const gap=Math.abs(first.prog-second.prog);
    if(gap>=0.70) return {x:leader.x,y:leader.y,weight:1};
    // Leader stays dominant; P2 only nudges composition.
    const w2=Math.max(.03,Math.min(.12,(.70-gap)*.15));
    return {x:leader.x*(1-w2)+second.p.x*w2,y:leader.y*(1-w2)+second.p.y*w2,weight:1};
  }

  function overtakeFrame663(leader,cache,now,base){
    if(!leader||!cache) return base;
    let challenger=null;
    for(const e of cache.active.slice(0,3)){
      if(e.p===leader) continue;
      if((e.p._overtake642Until||0)>now-180){challenger=e.p;break;}
    }
    if(!challenger) return base;
    // Overtake emphasis is modest and may never pull the camera away from P1.
    return {x:leader.x*.91+challenger.x*.09,y:leader.y*.91+challenger.y*.09,weight:1};
  }

  function packFrame664(leader,cache,base){
    if(!leader||!cache||cache.top.length<3) return base;
    const lp=cache.top[0].prog;
    const close=cache.top.filter(e=>lp-e.prog<1.45);
    if(close.length<3) return base;
    let cx=0,cy=0;
    for(const e of close){cx+=e.p.x;cy+=e.p.y;}
    cx/=close.length;cy/=close.length;
    // Maximum 10% pack influence, so actual P1 remains the camera anchor.
    return {x:leader.x*.90+cx*.10,y:leader.y*.90+cy*.10,weight:1};
  }

  function smoothCamera665(dt,tx,ty){
    const dx=tx-camX,dy=ty-camY;
    const dist=Math.hypot(dx,dy);
    const a=Math.min(.22,Math.max(.095,dt*.0062));
    let sx=dx*a,sy=dy*a;
    const maxStep=Math.max(1.25,dt*.115);
    const step=Math.hypot(sx,sy);
    if(step>maxStep&&step>0){sx*=maxStep/step;sy*=maxStep/step;}
    // Tiny dead zone prevents camera micro-jitter on nearly tied progress samples.
    if(dist<.10) return;
    camX+=sx;camY+=sy;
  }

  function sanitizeRaceState666(p){
    if(!p) return false;
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){
      p.x=31.05;p.y=132.55;p.seg=0;
      p.prevX=p.x;p.prevY=p.y;p.simPrevX=p.x;p.simPrevY=p.y;
      p._lastLegal636={x:p.x,y:p.y};p._lastLegal619={x:p.x,y:p.y};
    }
    if(!Number.isFinite(p.seg)) p.seg=0;
    p.seg=Math.max(0,Math.min(segs.length-1,p.seg|0));
    if(p.done&&p.dead) p.dead=false;
    return true;
  }

  function finalAISafety667(p,si,target){
    if(!target) return null;
    let t=finalRoadTarget636(p,si,target);
    if(!t) return null;
    if(!courseContainsPoint(t.x,t.y,0.00) || !lineStaysOnCourse(p.x,p.y,t.x,t.y,0.00)){
      const ideal=strictInside620(p,si,gameNow());
      t=ideal?finalRoadTarget636(p,si,ideal):null;
    }
    return t;
  }

  function raceAI769(p,si,now){
    sanitizeRaceState666(p);
    const threat=collisionTTC622(p);
    let t=survivalRacingAI435(p,si,now);

    if(!threat){
      const rc=racecraft344(p,si,now);
      if(rc) t=rc;
    }

    t=westToUpperClimbGuard635(p,si,t);
    t=executionDifference660(p,si,now,t,!!threat);
    t=preventSlowMacroRoute659(p,si,now,t,!!threat);
    return finalAISafety667(p,si,t);
  }

  function auditedRaceTarget636(p,si,now){
    return raceAI769(p,si,now);
  }

  function racingLine529(p,si,now){
    const audit636=auditedRaceTarget636(p,si,now);
    if(audit636) return {...audit636,kind:(audit636.kind||"racing")+"-636"};
    const avoid630=avoidance330(p,si,now);
    if(avoid630) return avoid630;
    if(p.controlMode!=="normal") return null;
    if(now<(p.hardRouteLockUntil||0)) return null;
    if(now<(p.routeBreakCombatUntil||0)) return null;
    if((p.liveEvadeDanger||0)>.18 || p.liveEvadeThreat) return null;

    const three=linkedThreeCorner525(p,si);
    const two=linkedTwoCorner524(p,si);
    const corner=continuousCornerTarget523(p,si);
    const inside=fastInsideLine527(p,si);
    const edgeStraight=edgeAwareStraight526(p,si);
    const shortStraight=shortestStraightTarget521(p,si);

    // Compare legal candidates by estimated short-horizon distance rather than
    // blindly preferring one system. Linked-corner plans get a small priority
    // only when their distance is essentially equivalent.
    const inside604=insideLine604(p,si,now);
    const ai610=integratedAI610(p,si,now);
    const rl415=racingLine415(p,si,now);
    const drive419=drivingAI419(p,si,now);
    const drive420=drivingAI420(p,si,now);
    if(drive420) return {...drive420,kind:(drive420.kind||"racing")+"-620"};
    const pool=[drive419,rl415,ai610,inside604,three,two,corner,inside,edgeStraight,shortStraight];
    const best=chooseShortest529(p,si,pool);
    if(!best) return null;

    const bestLen=estimatedPathLength528(p,si,best);
    for(const linked of [three,two]){
      if(!linked) continue;
      const ll=estimatedPathLength528(p,si,linked);
      if(ll<=bestLen+.38){
        return {...linked,kind:linked.kind+"-529"};
      }
    }

    return {...best,kind:(best.kind||"racing")+"-529"};
  }

function updatePlayer(p, now, dt){
    if(p.done || p.dead) return;
    p.simPrevX=p.x; p.simPrevY=p.y;

    // v2.29 start reaction: milliseconds matter without changing base pace.
    if(raceStart && now-raceStart<p.startReactionMs) return;

    if(now < p.stunUntil){
      p.continuousRunMs=0;p.continuousRunMul=1;
      return;
    }
    if(p.stunUntil){
      p.stunUntil=0;
      p.invUntil=now+INV_MS;
      p.lastAdvanceAt=now;
      p.lastProgress=currentProgress(p);
      const recovery=(p.stats.recovery-72)/27;
      p.resumeEaseUntil=now+(470-recovery*150);
    }

    chooseControl(p,now,dt);

    // v2.60 collision-free confidence: grows over ~12s, resets only on actual observer hit.
    p.cleanConfidenceMs=Math.min(12000,(p.cleanConfidenceMs||0)+dt);
    p.cleanConfidence=Math.max(0,Math.min(1,p.cleanConfidenceMs/12000));

    const si=Math.min(p.seg,segs.length-1);
    const s=segs[si];
    const half=widths[si]*0.72;

    // v5.08: final-straight Y lock is local to the last horizontal corridor.
    if(!finalStraight508(si)){
      p.finalStraightY508=NaN;
      p.finalStraightSeg508=-1;
    }
    let targetOff=optimalOffsetFor(p);
    const plannedOff=plannedRacingOffset(p,si,now);
    const packOff=packContextOffset(p,si,now);
    // Players are non-solid. Pack logic only adds subtle tactical route variety.
    const packWeight=Math.min(0.16,0.055+(p.drivingStyle.pack-0.90)*0.28);
    const identityWeight=.095;
    const identityOff=(p.routeIdentityBias||0)*Math.max(1.8,widths[si]*.54);
    // v4.10: globally trust the shortest optimized line more, while keeping enough
    // personality/pack weight for racers to remain recognisably different.
    targetOff=targetOff*.065+plannedOff*(.84-packWeight-identityWeight)+packOff*packWeight+identityOff*identityWeight;
      // Legacy pre-v4.64 corner shaping is retained only while an observer field is
      // active. On clear road, Racing Line 2.1 + Cornering Physics 2.0 owns the line.
      const legacyCornerShaping = playerPerceivedObservers(p,26.0).length>0;
      // Kart-style cornering: aggressively approach the inside/apex on turns.
      const insideSide=cornerInsideSide(si);
      const turnPower=cornerIntensity(si);
      if(legacyCornerShaping && insideSide!==0 && turnPower>0.055){
        const halfRoad=Math.max(1.8,widths[si]*1.13);
        const apexOff=insideSide*halfRoad*INSIDE_CORNER_STRENGTH;
        const apexBlend=Math.min(0.999,0.955+turnPower*1.68);
        targetOff=targetOff*(1-apexBlend)+apexOff*apexBlend;
      }

      // Look ahead several route segments so the racer hugs the inside wall before
      // the corner actually begins instead of waiting until the midpoint.
      const futureInside=futureInsideBias(si);
      if(legacyCornerShaping && Math.abs(futureInside)>0.10){
        const halfRoad2=Math.max(1.8,widths[si]*1.15);
        const futureApex=futureInside*halfRoad2*1.075;
        targetOff=targetOff*0.012+futureApex*0.988;
      }

      // v4.15: hold the inside side across the whole approach straight. The
      // target is derived only from upcoming route curvature, so it works on
      // every similar section and does not encode screenshot coordinates.
      const earlyInside=openingInsideBias(si);
      if(legacyCornerShaping && Math.abs(earlyInside)>.08){
        const halfRoad3=Math.max(1.8,widths[si]*1.13);
        const insideSkill=Math.max(0,Math.min(1,(p.stats.insideLine-72)/27));
        const earlyTarget=earlyInside*halfRoad3;
        const earlyBlend=.72+insideSkill*.20;
        targetOff=targetOff*(1-earlyBlend)+earlyTarget*earlyBlend;
      }

      // v4.16: on the opening long straight, shortest-path geometry gets final
      // authority over route personality. All racers begin overlapped, then fan
      // naturally only when observer avoidance or player traits justify it.
      const openingFast=openingFastLineTarget(p,si);
      if(legacyCornerShaping && openingFast!=null){
        const read=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
        // v4.27: openingFast already contains the racer's lane signature. Give it
        // strong authority so the pack visibly fans out from the overlapped start.
        const blend=.975+read*.020;
        targetOff=targetOff*(1-blend)+openingFast*blend;
      }

    // Lower line skill adds slightly more steering error, while everyone still
    // follows the optimized racing line most of the time.
    const lineError=(100-p.profile.line)/100;
    const precision=(p.stats.insideLine+p.stats.cornering+p.stats.routeReading)/300;
    const precisionNoise=0.004+(1-precision)*0.285;
    targetOff += Math.sin((now/1000)*0.7+p.index*1.3)*half*precisionNoise;

    // High inside-line racers visibly hold a tighter apex; lower line skill leaves
    // a little more safety margin, making player identities readable in motion.
    const insideNow=cornerInsideSide(si);
    if(insideNow!==0 && cornerIntensity(si)>0.06){
      const insideCommit=(p.stats.insideLine-72)/27;
      const styleApex=(identityOf(p).apex-1)*.42;
      const personalityApex=(p.linePersonality||0)*.095;
      const skillApex=insideNow*half*Math.min(.995,Math.max(.54,0.69+insideCommit*0.23+styleApex+personalityApex));
      targetOff=targetOff*(0.40-insideCommit*0.12)+skillApex*(0.60+insideCommit*0.12);
    }

    const passPlan=overtakePlan(p,si,now);
    if(passPlan){
      // Strong enough to be visible, but observer avoidance below still has final authority.
      const passBlend=passPlan.mode===1?.66:passPlan.mode===2?.58:.52;
      targetOff=targetOff*(1-passBlend)+passPlan.off*passBlend;
    }

    const clutchPlan=clutchRacePlan(p,si,now);
    if(clutchPlan && Math.abs(clutchPlan.off)>.01){
      // Final-section decisions are visible, but avoidance below keeps final authority.
      targetOff=targetOff*.38+clutchPlan.off*.62;
    }

    targetOff=preCornerPositionTarget(p,si,now,targetOff);
    targetOff=linkedCornerTarget(p,si,targetOff);
    targetOff=precisionCornerTarget(p,si,now,targetOff);
    targetOff=finalCornerBattleTarget(p,si,now,targetOff);
    targetOff=tacticalSituationOffset(p,si,now,targetOff);
    targetOff=tacticalVariantOffset(p,si,now,targetOff);
    targetOff=stabilizeDrivingLine(p,si,targetOff);
    const humanDrive=humanDrivingAdjustment(p,si,now,targetOff);
    targetOff=humanDrive.off;
    targetOff=startOpeningTarget(p,si,now,targetOff);
    const unitAI=unitAdaptationOf(p);
    // Unit identity bends the chosen racing line, but never overrides observer avoidance.
    if(insideNow!==0 && cornerIntensity(si)>.045){
      const unitApex=insideNow*half*Math.min(.995,.70+unitAI.fit*.22);
      const ub=Math.max(0,Math.min(.24,(unitAI.apex-1)*1.8+.10));
      targetOff=targetOff*(1-ub)+unitApex*ub;
    }
    targetOff=pressureLineAdjustment(p,si,now,targetOff);
    if(now<p.shockAvoidUntil){
      targetOff=targetOff*.16+p.shockAvoidOffset*.84;
    }

    // v4.65 CLEAR-ROAD / PASS AUTHORITY: with no perceived observer field, the map-wide
    // Racing Line 2.0 is the macro route. Personality/tactics may add tiny execution
    // texture, but they may not choose a knowingly slower lane.
    const clearRoadObs=playerPerceivedObservers(p,26.0);
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      const fastLine=optimalRacingLine2Offset(p,si);
      const lineSkill=Math.max(0,Math.min(1,((p.stats.cornering+p.stats.insideLine+p.stats.routeReading+p.stats.control)/4-72)/27));
      const trust=.965+lineSkill*.030;
      targetOff=targetOff*(1-trust)+fastLine*trust;
    }

    // v4.64 CORNERING PHYSICS 2.0: the map-wide line is refined by a local
    // entry/apex/exit model only on observer-free road. Observer avoidance below
    // still has absolute final authority.
    let cornerPhysics64={off:targetOff,speedMul:1,type:"traffic"};
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      cornerPhysics64=cornerPhysics64Target(p,si,targetOff);
      targetOff=cornerPhysics64.off;
    }

    // v4.66 MULTI-CAR LINE AUTHORITY:
    // 4.64 remains the solo/leader baseline. Only real nearby racer traffic may
    // bend that line; then 4.65's explicit overtake plan may make the final attack.
    let multiCar66={off:targetOff,mode:"observer",authority:0};
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      const solo66=cornerPhysics64.off;
      multiCar66=multiCarRacingLine66(p,si,now,solo66);
      if(multiCar66.authority>0){
        targetOff=targetOff*(1-multiCar66.authority)+multiCar66.off*multiCar66.authority;
      }
    }

    // v4.65 PASS AUTHORITY: 4.64 correctly made the solo optimal line dominant,
    // but that also erased most passing moves. When another racer actually blocks
    // that line, allow the selected overtake corridor to override it. Observers still
    // have final authority in chooseAvoidance() below.
    if(passPlan && clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      const myProg65=currentProgress(p);
      const target65=players[p.passTargetId];
      const rel65=target65&&!target65.done ? currentProgress(target65)-myProg65 : 99;
      if(rel65>-1.0 && rel65<10.5){
        const passSkill65=Math.max(0,Math.min(1,
          ((p.stats.aggression+p.stats.prediction+p.stats.routeReading+p.stats.control)/4-72)/27));
        let authority65=(passPlan.mode===2?.74:passPlan.mode===3?.70:.82)+passSkill65*.08;
        const leadPass67=leaderLineDiscipline67(p,si);
        if(leadPass67.leadBattle) authority65=Math.min(authority65,.52);
        targetOff=targetOff*(1-authority65)+passPlan.off*authority65;
        targetOff=raceLine79(p,si,targetOff,true);
      }
    }

    // v4.68 FINAL SHORTEST-LINE AUTHORITY:
    // On clear road, normal racing is pulled back toward the inside-shortest route.
    // A real active overtake is the only racer-traffic exception.
    if(clearRoadObs.length===0 && now>=p.shockAvoidUntil){
      targetOff=driverStyle68Line(p,si,targetOff,!!passPlan);
      if(!passPlan){
        // v4.70-v4.73 integrated fastest-line authority.
        const fast69=cornerPhysics64Target(p,si,optimalRacingLine2Offset(p,si)).off;
        const fast74=integratedFastLine74(p,si,fast69);
        const chase75=chaseLine75(p,si,fast74);
        const fast79=raceLine79(p,si,chase75,false);
        targetOff=targetOff*.035+fast79*.965;
      }
    }

    let speedMul=(clearRoadObs.length===0?cornerPhysics64.speedMul:humanDrive.speedMul)*unitAI.pace;
    if(passPlan) speedMul*=passPlan.speedMul;
    if(clutchPlan) speedMul*=clutchPlan.speedMul;
    if(now<p.startLaunchUntil){
      // Only the opening launch is affected; after ~2 s everyone returns to normal pace.
      speedMul*=p.startLaunchMul*p.startExecution;
    }
    const controlSkill=(p.profile.control-85)/15;

    // v4.67 LEAD-BATTLE DISCIPLINE: P1/P2 in a close fight stay almost entirely
    // on the fast line until an observer threat genuinely requires a dodge.
    const lead67=leaderLineDiscipline67(p,si);
    if(clearRoadObs.length===0 && lead67.leadBattle && now>=p.shockAvoidUntil){
      targetOff=targetOff*.03+lead67.solo*.97;
    }

    // v4.67 unified survival/racing policy. The avoidance planner still detects danger,
    // but its route is scored against the optimized racing line and large exterior arcs
    // are suppressed unless the predicted collision risk is genuinely severe.
    const avoid=chooseAvoidance(p,s,now);
    if(avoid){
      if(avoid.mode==="stop"){
        speedMul*=.72;
      }else{
        const unified67=unifiedLine67(p,si,targetOff,avoid);
        const leadBlend=lead67.leadBattle?.66:.82;
        targetOff=targetOff*(1-leadBlend)+unified67.off*leadBlend;
        speedMul*=unified67.speedMul;
      }
    }
    if(!avoid && p.avoidPlanUntil && now>=p.avoidPlanUntil){
      p.avoidRecoverOffset=p.avoidPlanOffset;
      p.avoidRecoverStart=now;
      const recovery=(p.stats.recovery-72)/27;
      p.avoidRecoverUntil=now+(500-recovery*120);
      p.avoidPlanOffset=targetOff;
      p.avoidPlanSpeedMul=1;
      p.avoidPlanRisk=0;
      p.avoidPlanUntil=0;
    }
    if(!avoid && now<p.avoidRecoverUntil){
      const duration=Math.max(300,p.avoidRecoverUntil-(p.avoidRecoverStart||now));
      const t=Math.max(0,Math.min(1,(now-(p.avoidRecoverStart||now))/duration));
      // v4.64 SAFE REJOIN 3.1: recover toward the optimized line only as quickly as
      // the road ahead permits. Clear straights rejoin quickly; an approaching corner
      // or visible observer chain keeps the current safe line until the geometry settles.
      const recoveryN=Math.max(0,Math.min(1,(p.stats.recovery-72)/27));
      const routeReadN=Math.max(0,Math.min(1,(p.stats.routeReading-72)/27));
      const aheadObs=playerPerceivedObservers(p,22.0).length;
      let futureTurn=cornerIntensity(si);
      for(let rk=1;rk<=3;rk++) futureTurn=Math.max(futureTurn,cornerIntensity(Math.min(segs.length-1,si+rk))*(1-rk*.12));
      const clearFactor=aheadObs===0?1:(aheadObs===1?.68:.38);
      const cornerFactor=Math.max(.30,1-futureTurn*2.25);
      const smooth=t<.18 ? t*.25 : t<.68 ? .045+(t-.18)*1.28 : .685+(t-.68)*.98;
      let rejoinAuthority=Math.max(.24,Math.min(1,clearFactor*cornerFactor*(1.02+recoveryN*.10+routeReadN*.08)));
      const leadRejoin67=leaderLineDiscipline67(p,si);
      if(leadRejoin67.leadBattle && aheadObs===0){
        // P1/P2 restore the fast line quickly once the threat is clear.
        rejoinAuthority=Math.max(rejoinAuthority,.95);
      }
      const blend=Math.max(0,Math.min(1,smooth*rejoinAuthority));
      // v4.63: rejoin the future optimal macro-line, not merely the nearest local lane.
      const rejoinBase=cornerPhysics64Target(p,si,optimalRacingLine2Offset(p,si)).off;
      const rejoin=raceLine79(p,si,integratedFastLine74(p,si,rejoinBase),false);
      const from=p.avoidRecoverOffset;
      targetOff=from*(1-blend)+rejoin*blend;
      // If the road is completely clear and nearly straight, don't carry a slow
      // avoidance lane for the full recovery timer. Snap back progressively faster.
      if(aheadObs===0 && futureTurn<.075 && t>.16){
        const fastBlend=Math.min(.985,.78+(t-.16)*.78+recoveryN*.08);
        targetOff=targetOff*(1-fastBlend)+rejoin*fastBlend;
      }
    }
    // v4.10 EXTREME INSIDE: a deliberate high-risk shortest-line gamble.
    // It is applied after ordinary avoidance planning so committed racers do not
    // instantly cancel the gamble and become uniformly safe. Observer avoidance still
    // contributes through steering/control, but the racing-line commitment dominates.
    const extremeOff=extremeInsideAdjustment(p,si,now,targetOff);
    if(p.extremeInsideActive){
      const commit=p.extremeInsideFail?.94:.88;
      targetOff=targetOff*(1-commit)+extremeOff*commit;
      // Successful extreme line gets a tiny momentum reward from shorter geometry,
      // never a rubber-band speed boost. Failed attempts get no artificial slowdown.
      if(!p.extremeInsideFail) speedMul*=1.004;
    }

    const controlCanOverride = p.reactiveControl || !avoid;
    const cq=Math.max(.55,Math.min(1,p.controlQuality||1));
    const failedControl=!p.controlSuccess;
    if(controlCanOverride && p.controlMode==="zigzag"){
      const amp=((p.reactiveControl?.62:.46)+controlSkill*.09)*(failedControl?1.16:1);
      targetOff += Math.sin(now*0.023+p.index)*half*amp;
      if(failedControl) targetOff+=p.controlMistakeSide*half*.10*(1-cq);
      speedMul*=p.reactiveControl
        ? ((0.985+controlSkill*.025)*(failedControl?.91:.995))
        : ((0.945+controlSkill*.045)*(failedControl?.89:1));
    } else if(controlCanOverride && p.controlMode==="diagonal"){
      // v4.191 diagonal dodge: a short forward-biased sidestep around a nearby threat.
      const elapsed=Math.max(0,now-p.modeStart),dur=Math.max(1,p.controlUntil-p.modeStart);
      const t=Math.max(0,Math.min(1,elapsed/dur));
      const side=p.controlMistakeSide||p.liveEvadeSide||(p.index%2?1:-1);
      const pulse=Math.sin(Math.PI*t);
      targetOff += side*half*(.48+controlSkill*.12)*pulse;
      speedMul*=.99+controlSkill*.025;
    } else if(controlCanOverride && p.controlMode==="spin360"){
      // v4.191 360-control: a compact circular feint while maintaining forward progress.
      const elapsed=Math.max(0,now-p.modeStart),dur=Math.max(1,p.controlUntil-p.modeStart);
      const t=Math.max(0,Math.min(1,elapsed/dur));
      const side=p.controlMistakeSide||p.liveEvadeSide||(p.index%2?1:-1);
      targetOff += side*half*.46*Math.sin(t*Math.PI*2);
      speedMul*=.91+controlSkill*.05;
      p.visualAngle += side*(Math.PI*2)*Math.min(1,dt/dur);
    } else if(controlCanOverride && p.controlMode==="marseille"){
      const elapsed=Math.max(0,now-p.modeStart);
      const dur=Math.max(1,p.controlUntil-p.modeStart);
      const t=Math.max(0,Math.min(1,elapsed/dur));
      // v3.62: visible Marseille-style hook. Three phases:
      // commit to the open side -> curl back across the threat -> rejoin forward line.
      // It never mutates p.seg and the final offset is still clamped by the real road.
      // v3.7: clearer four-phase Marseille motion:
      // 1) hard side feint, 2) hook behind the threat, 3) opposite-side curl,
      // 4) smooth forward rejoin. Still only an offset/speed decision: never seg mutation.
      const hook=t<.25
        ? Math.sin((t/.25)*Math.PI*.5)
        : t<.56
          ? 1-Math.sin(((t-.25)/.31)*Math.PI)*1.72
          : t<.80
            ? -.72+Math.sin(((t-.56)/.24)*Math.PI*.5)*.54
            : -.18*(1-(t-.80)/.20);
      const curl=Math.sin(t*Math.PI*2)*.30;
      targetOff += p.marseilleSide*half*(hook*.78+curl);
      speedMul*=.925+Math.sin(t*Math.PI)*.070;
    } else if(controlCanOverride && p.controlMode==="backcon"){
      const elapsed=now-p.modeStart;
      const style=p.backconStyle||"long";

      if(style==="tap"){
        // Very short rear tap: immediately snaps forward after a tiny reverse.
        const reverseMs=(p.reactiveControl
          ? Math.max(38,58-controlSkill*10)
          : Math.max(48,72-controlSkill*12))*(failedControl?1.16:1);
        const escapeSide=failedControl?p.controlMistakeSide:(p.index%2?1:-1);
        targetOff += escapeSide*half*(.09+controlSkill*.035)*(failedControl?1.20:1);
        speedMul = elapsed<reverseMs
          ? (-0.10+controlSkill*.018)
          : ((1.20+controlSkill*.045)*(failedControl?.90:1));
      }else{
        // Long back-control: a clearly visible backward move followed by a stronger forward release.
        const reverseMs=(p.reactiveControl
          ? Math.max(210,310-controlSkill*60)
          : Math.max(245,365-controlSkill*72))*(failedControl?1.22:1);
        const escapeSide=failedControl?p.controlMistakeSide:(p.index%2?1:-1);
        targetOff += escapeSide*half*(p.reactiveControl?.22:.30)*(failedControl?1.24:1);
        speedMul = elapsed<reverseMs
          ? (-0.58+controlSkill*.07)
          : ((1.24+controlSkill*.065)*(failedControl?.87:1));
      }
    } else if(controlCanOverride && p.controlMode==="stopcon"){
      // v2.20: failed stop-control duration is extended once in beginControl.
      speedMul=0;
    } else if(!avoid && p.controlMode==="wide"){
      const side=(failedControl?p.controlMistakeSide:(p.index%2?1:-1));
      targetOff += side*half*(0.52+controlSkill*0.07)*(failedControl?1.12:1);
      speedMul=(0.895+controlSkill*0.055)*(failedControl?.91:1);
    }

    // v4.36 CORNER SURVIVAL 2: do not defend the perfect inside apex when the
    // personally perceived observer field makes that apex the dangerous side. This
    // is a soft, skill-aware surrender of inside line: safe corners keep the fast
    // v4.16/v4.27 route, while danger progressively moves the target toward the
    // current lane or the safer half of the road before live dodge takes authority.
    {
      const cSide=cornerInsideSide(si);
      const cPower=cornerIntensity(si);
      if(cSide!==0 && cPower>.038){
        const seen=playerPerceivedObservers(p,20.5);
        if(seen.length){
          let insideRisk=0, outsideRisk=0, crossingRisk=0;
          const predN=Math.max(0,Math.min(1,(p.stats.prediction-72)/27));
          const riskN=Math.max(0,Math.min(1,(p.stats.riskControl-72)/27));
          for(const o of seen){
            const dx=o.x-p.x, dy=o.y-p.y;
            const along=dx*s.ux+dy*s.uy;
            if(along<-.8 || along>17.5) continue;
            const lat=dx*s.nx+dy*s.ny;
            const w=Math.max(.12,1-along/19);
            const onInside=(lat*cSide)>-.15;
            if(onInside) insideRisk+=w; else outsideRisk+=w;
            const rvx=(o.vx||0)-s.ux*p.speed, rvy=(o.vy||0)-s.uy*p.speed;
            const rv2=rvx*rvx+rvy*rvy;
            if(rv2>.01){
              const tc=Math.max(0,Math.min(1.75,-(dx*rvx+dy*rvy)/rv2));
              const cx=dx+rvx*tc, cy=dy+rvy*tc;
              const cpa=Math.hypot(cx,cy);
              if(tc>.04 && cpa<2.65){
                const cw=(2.65-cpa)/2.65*(1.2-tc*.28);
                crossingRisk+=cw;
                if((cy*s.ny+cx*s.nx)*cSide>-.2) insideRisk+=cw*.85;
                else outsideRisk+=cw*.55;
              }
            }
          }
          const apexThreat=Math.max(0,insideRisk-outsideRisk*.42)+crossingRisk*.32;
          if(apexThreat>.20){
            const halfNow=Math.max(1.8,widths[Math.min(si,widths.length-1)]*.57);
            const surrender=Math.max(0,Math.min(.78,(apexThreat-.16)*(.34+riskN*.12+predN*.10)));
            const safeOff=cSide>0 ? Math.min(targetOff,halfNow*.18) : Math.max(targetOff,-halfNow*.18);
            targetOff=targetOff*(1-surrender)+safeOff*surrender;
            speedMul*=1-Math.min(.045,surrender*.035);
            p.cornerSurvivalSurrender=surrender;
          }else p.cornerSurvivalSurrender=0;
        }else p.cornerSurvivalSurrender=0;
      }else p.cornerSurvivalSurrender=0;
    }

    // v4.25 integrated corner + observer authority: the current racing/apex target is
    // passed into the human controller, so avoidance bends that line instead of fighting it.
    // When a visible observer is genuinely dangerous,
    // the racer temporarily abandons the ideal racing line and behaves like a human
    // making rapid mouse inputs. Once clear, v4.16 optimized/inside-line driving returns.
    const liveEvade=humanLiveEvadeController(p,s,now,targetOff);
    if(liveEvade){
      const emergency=Math.max(0,Math.min(1,(liveEvade.danger-.25)/1.55));
      const observerCombat=now<(p.routeBreakCombatUntil||0);
      const hardRouteLock=now<(p.hardRouteLockUntil||0) || !!liveEvade.routeLock;
      const authority=hardRouteLock ? 1.0 : (observerCombat ? .992 : (.72+emergency*.26));
      targetOff=hardRouteLock ? liveEvade.off : targetOff*(1-authority)+liveEvade.off*authority;
      speedMul=liveEvade.speedMul<0 ? liveEvade.speedMul : speedMul*(1-authority*.35)+liveEvade.speedMul*(authority*.35);
      // Human controller is allowed to reverse briefly even though ordinary anti-freeze
      // logic forbids accidental backward movement.
      if(liveEvade.speedMul<0) p.controlMode="backcon";
      // Human Dodge Controller action is authoritative while committed. This prevents
      // the older trick controller from layering a second contradictory maneuver.
      if(p.liveEvadeAction==='stop') p.controlMode='stopcon';
    }
targetOff=clampRoadOffset(si,targetOff,p);
    const steerControl=(p.stats.control-72)/27;
    // v2.7 anti-freeze: outside collision / explicit backcon / explicit stopcon,
    // every active racer keeps meaningful forward motion.
    if(now>=p.stunUntil && p.controlMode!=="stopcon" && p.controlMode!=="backcon" && p.liveEvadeAction!=="stop" && speedMul<.62){
      speedMul=.62;
    }

    // v4.85-v4.89 final integrated race-AI discipline:
    // after all tactical/control choices, remove unjustified exterior wandering
    // while preserving proportional room for a real observer threat or pass.
    targetOff=finalRaceDiscipline89(p,si,now,targetOff,avoid,!!passPlan);

    const steerTurn=cornerIntensity(si);
    targetOff=limitDecisionChanges(p,si,now,targetOff);

    // v5.01 FINAL AUTHORITY: calm horizontal road = route centerline.
    const centerLock501=horizontalCenterLock501(p,si,now);
    if(centerLock501 || horizontalHold503(p,si)){
      targetOff=0;
      p.desiredOffset += (0-p.desiredOffset)*Math.min(1,dt*.018);
    }

    const observerCombatSteer=now<(p.routeBreakCombatUntil||0);
    const steerEase=observerCombatSteer ? Math.min(.42,dt*(.0105+steerControl*.0018)) : Math.min(.092,dt*(.00218+steerControl*.00050+steerTurn*.00048));
    if(!centerLock501){
      p.desiredOffset += (targetOff-p.desiredOffset)*steerEase;
    }


    // v5.00 NORMAL RACING TARGET — restore the proven v3-style steering model.
    // Keep the current segment line, then blend ONLY 24% toward the next segment.
    // No multi-segment optimized lookahead, no shortcut layer, no horizontal-lock layer,
    // and no v4.91 re-targeting during calm racing.
    const next=segs[Math.min(segs.length-1,si+1)];
    const centerTarget501=horizontalCenterLock501(p,si,now);
    const horizontalHold503Active=horizontalHold503(p,si);
    const routeOff501=(centerTarget501||horizontalHold503Active)?0:p.desiredOffset;
    let tx=s.b[0]+s.nx*routeOff501;
    let ty=s.b[1]+s.ny*routeOff501;

    if(next && si<segs.length-1){
      const legacyHorizontal502=Math.abs(s.ux)>=.88;
      const look=(legacyHorizontal502||horizontalHold503Active)?0:0.24;
      const nx=next.b[0]+next.nx*routeOff501;
      const ny=next.b[1]+next.ny*routeOff501;
      let candX=tx*(1-look)+nx*look;
      let candY=ty*(1-look)+ny*look;

      // Restricted red zones are planning vetoes only. If the 24% look-ahead would
      // cross one, keep the current-segment target instead of inventing a detour.
      if(!inForbidden96(candX,candY) && !lineHitsForbidden96(p.x,p.y,candX,candY)){
        tx=candX; ty=candY;
      }
    }

    // Validate only against the ordinary road corridor + planning red-zone veto.
    // If the candidate is invalid, stay on the current segment target.
    if(inForbidden96(tx,ty) || lineHitsForbidden96(p.x,p.y,tx,ty) ||
       !lineStaysOnCourse(p.x,p.y,tx,ty,ROUTE_PLAN_EXTRA)){
      const bx=s.b[0]+s.nx*p.desiredOffset;
      const by=s.b[1]+s.ny*p.desiredOffset;
      if(!inForbidden96(bx,by) && !lineHitsForbidden96(p.x,p.y,bx,by)){
        tx=bx; ty=by;
      }
    }

    // Observer emergency remains authoritative exactly as before.
    if(now<(p.hardRouteLockUntil||0) && Number.isFinite(p.lockedEscapeOffset)){
      const lockTier=p.dangerTier||0;
      const escapeAhead=(lockTier>=3?8.9:10.2)+Math.max(0,Math.min(1,(p.stats.control-72)/27))*1.35;
      let ex=p.x+s.ux*escapeAhead+s.nx*p.lockedEscapeOffset;
      let ey=p.y+s.uy*escapeAhead+s.ny*p.lockedEscapeOffset;
      const legalEscape=courseAwareTarget(p,si,ex,ey);
      tx=legalEscape.x; ty=legalEscape.y;
    }

    // v5.07 FINAL BROAD-ROAD AUTHORITY:
    // On calm broad road, replace edge-biased/offset-biased targets with the farthest
    // legal center/shortest chord through the road surface.
    // v5.20~v5.23 Racing Line 3.0 phase 1.
    const racing529=racingLine529(p,si,now);
    p.routeSource523=racing529?.kind || "legacy";
    let broad507=null;
    if(racing529 && !liveEvade){
      tx=racing529.x;
      ty=racing529.y;
    }else{
      broad507=broadRoadTarget507(p,si,now);
      if(broad507 && !liveEvade){
        tx=broad507.x;
        ty=broad507.y;
      }
    }

    // v5.16 ROUTE -> STEERING separation.
    // Everything above chooses the route target. Only steeringTarget516 is allowed
    // to turn that route decision into the local movement target.
    const routeTarget516={x:tx,y:ty};
    const steerTarget516=steeringTarget516(p,si,now,routeTarget516,liveEvade);
    tx=steerTarget516.x;
    ty=steerTarget516.y;

    // v6.36 final planner invariant: even legacy steering layers cannot hand
    // the virtual mouse a target whose chord leaves the legal road.
    {
      const road636=finalRoadTarget636(p,si,{x:tx,y:ty,kind:"post-steer636"});
      if(road636){tx=road636.x;ty=road636.y;}
    }

    // v5.19: after an abnormal move, briefly shrink the next steering target
    // instead of letting a second large correction compound the mistake.
    if(now<(p.anomalyUntil519||0) && !liveEvade){
      const s519=segs[Math.max(0,Math.min(segs.length-1,si))];
      const dx519=tx-p.x, dy519=ty-p.y;
      const f519=dx519*s519.ux+dy519*s519.uy;
      let l519=dx519*s519.nx+dy519*s519.ny;
      l519=Math.max(-.72,Math.min(.72,l519));
      const ff519=Math.max(2.0,Math.min(6.5,f519));
      tx=p.x+s519.ux*ff519+s519.nx*l519;
      ty=p.y+s519.uy*ff519+s519.ny*l519;
    }

    // v5.17: capture route-vs-steering authority before movement.
    recordDriveDebug519(p,si,now,routeTarget516,steerTarget516,0,0,liveEvade);

    // v4.59.9 AI DEATH BLACKBOX: sample what the racer actually sees/decides before
    // the virtual mouse consumes the planner output. Diagnostic only; no steering changes.
    recordAiBlackboxSample(p,now,tx,ty);

    // v4.23 VIRTUAL MOUSE + HUMAN REACTION + PERSONAL VISION: the planner above is now the player's "eyes + brain" only.
    // It proposes a click, but steering consumes the last committed click target.
    // Safe running uses relaxed human click cadence; real danger shortens the cadence.
    // The click event itself is logged so later replay/debug can show genuine inputs,
    // never a reconstructed movement trace.
    {
      const reactionN=Math.max(0,Math.min(1,(p.stats.reaction-72)/27));
      const controlN=Math.max(0,Math.min(1,(p.stats.control-72)/27));
      const dangerN=Math.max(0,Math.min(1,p.liveEvadeDanger||0));
      const dangerTier=p.dangerTier||0;
      const threatId=liveEvade ? (p.liveEvadeThreat??-1) : -1;
      const dangerActive=!!liveEvade || now<(p.hardRouteLockUntil||0); // v4.60 route lock forbids race-mode clicks
      // A newly recognized threat does not instantly become a mouse input. The racer
      // spends a short player-specific judgment/hand delay while continuing the last command.
      if(dangerActive && (!p.reactionDangerActive || threatId!==p.reactionThreatId)){
        const urgency=Math.max(0,Math.min(1,dangerN/1.35));
        const cmdDelay=humanCommandDelayMs(p,urgency);
        p.mouseReactionReadyAt=now+cmdDelay;
        p.lastReactionDelayMs=cmdDelay;
        p.reactionThreatId=threatId;
        p.reactionDangerActive=true;
      }else if(!dangerActive){
        p.reactionDangerActive=false;
        p.reactionThreatId=-1;
        p.mouseReactionReadyAt=0;
      }
      const distToHeld=Math.hypot((p.mouseTargetX??p.x)-p.x,(p.mouseTargetY??p.y)-p.y);
      const routeBreakInterrupt=!!p.routeBreakForceClick && dangerActive;
      const needsClick=routeBreakInterrupt || now>=p.mouseNextThink || now>=p.mouseCommandUntil || distToHeld<1.05;
      // v4.40 emergency re-judgment: human delay still exists, but an already obvious
      // imminent collision may interrupt it once instead of watching the racer drive straight in.
      // v4.43 LATE_REACTION fix: tier-2 remains an immediate interrupt; a very short
      // predicted time-to-contact can also interrupt the tail of the human delay.
      const imminentRead=dangerActive && (p.liveEvadeDanger||0)>.48 && (p.dangerTier||0)>=1;
      const emergencyReaction=dangerActive && (now<(p.routeBreakCombatUntil||0) || (p.dangerTier||0)>=2 || (p.liveEvadeDanger||0)>.72 || imminentRead);
      const reactionReady=!dangerActive || emergencyReaction || now>=(p.mouseReactionReadyAt||0);
      if(needsClick && reactionReady){
        // Human-like imperfect click placement. Better control means less pointer error.
        // Error is tiny and continuous; it does not create random lane changes.
        const err=(1-controlN)*(dangerActive?0.070:0.205);
        const reach=Math.max(.82,Math.min(1.06,p.mouseReach||1));
        let mx=p.x+(tx-p.x)*reach+(Math.random()-.5)*err;
        let my=p.y+(ty-p.y)*reach+(Math.random()-.5)*err;
        if(!dangerActive && horizontalCenterLock501(p,si,now)){
          my=ty;
        }
        // v5.00: calm-racing mouse clicks consume the v3-style planner target directly.
        // Do not run v4.90~v4.95 re-targeting layers here.
        // v4.31 shorter human clicks: reduce the frequency of long screen-spanning
        // commands. Danger uses especially short re-readable clicks so the racer can
        // react to the next observer without twitching every frame.
        const clickDx=mx-p.x, clickDy=my-p.y, clickD=Math.hypot(clickDx,clickDy)||1;
        // v4.35 tiered click reach: safe road stays relaxed, watch uses short
        // corrections, danger/emergency use decisive but still bounded escape clicks.
        // v4.59.4 clear-road reach: when the racer currently perceives no observer
        // nearby, allow a longer deliberate race click. As soon as anything enters
        // the personal field, fall back to the shorter v4.31 re-readable cadence.
        const clearForLongClick=!dangerActive && playerPerceivedObservers(p,21.5).length===0;
        const unitClick=unitAI.click||1;
        const maxClickDist=(!dangerActive ? (clearForLongClick ? (10.35+controlN*1.50) : (8.25+controlN*1.05))
          : dangerTier>=3 ? (6.75+controlN*.85)
          : dangerTier===2 ? (6.35+controlN*.82)
          : (5.75+controlN*.76))*unitClick;
        if(clickD>maxClickDist){ mx=p.x+clickDx/clickD*maxClickDist; my=p.y+clickDy/clickD*maxClickDist; }
        const legalMouse=(!dangerActive && broad507)
          ? {x:mx,y:my}
          : courseAwareTarget(p,si,mx,my);
        mx=legalMouse.x; my=legalMouse.y;
        const prevMouseX=p.mouseTargetX??p.x, prevMouseY=p.mouseTargetY??p.y;
        const nextMode=liveEvade ? (p.liveEvadeAction==='back'?'back':p.liveEvadeAction==='stop'?'stop':p.liveEvadeAction||'evade') : (now<(p.hardRouteLockUntil||0)?'route-lock':'race');
        if(Math.hypot(mx-prevMouseX,my-prevMouseY)<.38 && nextMode===(p.mouseMode||'race')) p.aiDiagRedundantClicks=(p.aiDiagRedundantClicks||0)+1;
        if(nextMode!==(p.aiDiagLastMode||'race')){ p.aiDiagModeChanges=(p.aiDiagModeChanges||0)+1; p.aiDiagLastMode=nextMode; }
        p.mouseTargetX=mx; p.mouseTargetY=my;
        p.mouseMode=nextMode;
        if(routeBreakInterrupt) p.routeBreakForceClick=false;
        p.mouseLastClickAt=now; p.mouseClickSeq=(p.mouseClickSeq||0)+1;
        if(!Array.isArray(p.mouseClickLog)) p.mouseClickLog=[];
        p.mouseClickLog.push({seq:p.mouseClickSeq,t:now,x:+mx.toFixed(3),y:+my.toFixed(3),mode:p.mouseMode,threatId:p.liveEvadeThreat??-1,perceived21:playerPerceivedObservers(p,21.5).length,danger:+(p.liveEvadeDanger||0).toFixed(3),tier:p.dangerTier||0,routeBreak:!!p.routeBreakForceClick,committed:now<(p.committedEscapeUntil||0)});
        if(p.mouseClickLog.length>1800) p.mouseClickLog.splice(0,p.mouseClickLog.length-1800);
        // v4.26 individual click rhythm: patient/safe racers use longer deliberate
        // commands; attackers/opportunists click sooner and farther. Under danger the
        // personal danger tempo remains visible without creating per-frame twitching.
        const rhythm=Math.max(.78,Math.min(1.22,p.mouseRhythm||1));
        const dangerTempo=Math.max(.78,Math.min(1.12,p.mouseDangerTempo||1));
        const calmMs=(245-reactionN*45+Math.random()*105)*rhythm;
        const dangerMs=(92-reactionN*24+Math.random()*48)*dangerTempo;
        // v4.35 tiered judgment cadence. Escalation speeds decisions up; safe road
        // remains calm. This is cadence, not omniscience: v4.23 reaction gate still applies.
        const unitThink=unitAI.think||1;
        let cadence = (dangerTier>=3 ? Math.max(48,dangerMs*.68)
          : dangerTier===2 ? Math.max(58,dangerMs*.84)
          : dangerTier===1 ? Math.max(72,dangerMs*1.02)
          : calmMs)*unitThink;
        // v4.59.5: keep v4.59.4 click reach, but hold a clean-road command slightly longer.
        if(now<(p.committedEscapeUntil||0)) cadence=Math.max(cadence,205+Math.random()*75);
        else if(now<(p.hardRouteLockUntil||0)) cadence=Math.max(cadence,175+Math.random()*65);
        else if(now<(p.routeBreakCombatUntil||0)) cadence=Math.max(cadence,145+Math.random()*55);
        if(dangerTier===0 && playerPerceivedObservers(p,21.5).length===0) cadence*=1.10;
        if(p.mouseMode==='stop') cadence=Math.min(cadence,48+Math.random()*22);
        p.mouseNextThink=now+cadence;
        p.mouseCommandUntil=now+cadence+(p.mouseMode==='stop'?18:120);
      }
      tx=p.mouseTargetX; ty=p.mouseTargetY;
    }

    // v6.36 stale-click guard: a previously held mouse target may have become
    // illegal after a corner/segment transition. Revalidate it every frame.
    {
      const road636=finalRoadTarget636(p,si,{x:tx,y:ty,kind:"held-mouse636"});
      if(road636){
        tx=road636.x;ty=road636.y;
        p.mouseTargetX=tx;p.mouseTargetY=ty;
      }
    }

    // v5.07 direct broad-road movement:
    // do not allow stale mouse/edge commands to turn a valid broad-road straight chord
    // into a one-tile edge-following L path.
    if((racing529 || (typeof broad507!=="undefined" && broad507)) && !liveEvade &&
       now>=(p.hardRouteLockUntil||0) &&
       now>=(p.routeBreakCombatUntil||0) &&
       p.controlMode==="normal"){
      // v5.13: keep the stabilized local target instead of restoring the far raw target.
      p.mouseTargetX=tx;
      p.mouseTargetY=ty;
    }

    // v5.09 LOCAL STEERING CLAMP:
    // Even if a planner target changes abruptly, only allow a modest lateral correction.
    // This prevents a leader from sweeping across the whole road and losing many places instantly.
    let dx=tx-p.x, dy=ty-p.y;
    const localSeg=segs[Math.min(si,segs.length-1)];
    if(localSeg){
      const forward=dx*localSeg.ux+dy*localSeg.uy;
      let lateral=dx*localSeg.nx+dy*localSeg.ny;
      const phase516=cornerPhase516(p,si);
      const baseMaxLat=Math.max(.80,Math.min(1.75,widths[si]*.17));
      const maxLat=(phase516.entering||phase516.exiting) ? Math.min(baseMaxLat,1.10) : baseMaxLat;
      lateral=Math.max(-maxLat,Math.min(maxLat,lateral));
      dx=localSeg.ux*forward+localSeg.nx*lateral;
      dy=localSeg.uy*forward+localSeg.ny*lateral;
      tx=p.x+dx;
      ty=p.y+dy;
    }
    const d=Math.hypot(dx,dy) || 1;
    const legacyCalm502 =
      !liveEvade &&
      now>=(p.hardRouteLockUntil||0) &&
      now>=(p.routeBreakCombatUntil||0) &&
      p.controlMode==="normal";

    let moveDirX,moveDirY;
    if(legacyCalm502){
      moveDirX=dx/d;
      moveDirY=dy/d;
      if(finalStraight508(si) && Number.isFinite(p.finalStraightY508)){
        // v5.08: after the 11 o'clock corner, the finish run is a literal horizontal line.
        moveDirX=Math.sign(route[route.length-1][0]-p.x)||1;
        moveDirY=0;
      }else if(horizontalHold503Active){
        // The road itself is horizontal here; do not carry any stale vertical heading.
        const dir=Math.sign(s.ux)||1;
        const centerErr=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
        if(Math.abs(centerErr)<0.55){
          moveDirX=dir;
          moveDirY=0;
        }
      }
      p.steerX=moveDirX;
      p.steerY=moveDirY;
      // Old builds did not carry a stale mouse heading into the next straight.
      p.mouseTargetX=tx;
      p.mouseTargetY=ty;
    }else{
      const ndx=dx/d, ndy=dy/d;
      const steerBlend=Math.min(.25,(.12+((p.stats.control-72)/27)*.07+cornerIntensity(si)*.06)*(unitAI.steer||1));
      p.steerX += (ndx-p.steerX)*steerBlend;
      p.steerY += (ndy-p.steerY)*steerBlend;
      const steerLen=Math.hypot(p.steerX,p.steerY)||1;
      moveDirX=p.steerX/steerLen;
      moveDirY=p.steerY/steerLen;
    }

    // v2.54 CONTINUOUS-RUN ACCELERATION:
    // uninterrupted forward running ramps to +3% effective pace over 2.6 s.
    // Any stop/reverse/backcon resets the build-up. Zigzag/normal moving dodges can
    // preserve momentum, rewarding the racer who keeps moving on the same line.
    const uninterruptedForward =
      speedMul>0.72 &&
      p.controlMode!=="stopcon" &&
      p.controlMode!=="backcon" &&
      now>=p.stunUntil;
    if(uninterruptedForward){
      p.continuousRunMs=Math.min(2600,(p.continuousRunMs||0)+dt);
    }else{
      p.continuousRunMs=0;
    }
    const runFactor=Math.max(0,Math.min(1,(p.continuousRunMs||0)/2600));
    p.continuousRunMul=1+runFactor*.03;
    if(speedMul>0) speedMul*=p.continuousRunMul;

    // v4.01 EDGE-STRIP SPEED NORMALIZATION:
    // The legal one-line strips on BOTH outer edges are normal road, not slow terrain.
    // Merely choosing/riding the edge line must never reduce pace. Real observer avoidance
    // and explicit control moves may still change speed when there is an actual threat.
    {
      const edgeRoadHalf=Math.max(1.8,widths[si]*ROAD_MARGIN*(p.wideDetourRace?1.025:1));
      const edgeLat=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
      if(Math.abs(edgeLat)>=edgeRoadHalf*.82 && p.controlMode==="normal"){
        const edgeThreats=playerPerceivedObservers(p,7.5);
        if(!edgeThreats.length) speedMul=Math.max(speedMul,1.0);
      }
    }

    // v3.3 오른쪽 3시 구간(seg 5~11): 실제 옵저버 위협/컨트롤이 없으면
    // 패스·코너 준비 AI 때문에 체감 감속이 생기지 않도록 정상 주행 속도를 보장.
    if(si>=5 && si<=11 && now>=p.stunUntil && p.controlMode==="normal"){
      const eastThreats=playerPerceivedObservers(p,7.5);
      if(!eastThreats.length) speedMul=Math.max(speedMul,1.0);
    }

    const step=p.speed*speedMul*dt/1000;
    const move=step>=0 ? Math.min(step,d) : Math.max(step,-0.55);

    // v5.18: abnormal-driving detector.
    detectAnomaly519(p,si,now,tx,ty,moveDirX,moveDirY);

    // v5.17 debug HUD data uses the actual final movement vector.
    recordDriveDebug519(p,si,now,routeTarget516,steerTarget516,moveDirX,moveDirY,liveEvade);

    p.x += moveDirX*move;
    p.y += moveDirY*move;

    // v6.36 physical road authority: clamp immediately after the movement step,
    // before OUTSIDE death, telemetry, segment advancement, or observer collision.
    enforcePhysicalRoad636(p);
    enforceProtectedClimb635(p);
    enforcePhysicalRoad636(p);

    // v5.00 restricted zones are PLANNING-ONLY.
    // If numerical error or emergency motion happens to enter one, do not teleport,
    // roll back, freeze, bounce, or otherwise alter the actual movement.

    // v5.00: no shortcut-route resync. Segment advancement below is sequential again.

    // v4.09 AIR UNIT: no wall, snap, bounce, or off-road slowdown.
    // Death uses the route-derived capsule union, not hand-written red coordinates.
    if(lethalOutsideRoad(p,now)){
      p.dead=true;
      p.match.collisions++;
      p.match.deathPoints.push({round:currentRound,t:Math.max(0,now-raceStart),progressPct:+(100*Math.max(0,Math.min(1,currentProgress(p)/routeLength))).toFixed(1),x:+p.x.toFixed(2),y:+p.y.toFixed(2),...deathCauseSnapshot(p,now,null,"OUTSIDE")});
      p.cleanConfidenceMs=0; p.cleanConfidence=0;
      return;
    }
    p.match.distance += Math.hypot(p.x-p.match.lastX,p.y-p.match.lastY);
    p.match.lastX=p.x;
    p.match.lastY=p.y;

    // v2.15 race telemetry: sample the actual driven line and a lightweight trace.
    // Sampling is throttled so this does not grow with render FPS.
    const teleSeg=segs[Math.min(p.seg,segs.length-1)];
    const tdx=p.x-teleSeg.a[0], tdy=p.y-teleSeg.a[1];
    const actualOff=tdx*teleSeg.nx+tdy*teleSeg.ny;
    const insideSideNow=cornerInsideSide(Math.min(p.seg,segs.length-1));
    if(insideSideNow!==0 && cornerIntensity(Math.min(p.seg,segs.length-1))>.04){
      p.match.lineSamples++;
      const roadHalf=Math.max(1.8,widths[Math.min(p.seg,widths.length-1)]*.57);
      const insideAmount=(actualOff*insideSideNow)/roadHalf;
      if(insideAmount>.48) p.match.insideHits++;
      if(insideAmount>.82) p.match.extremeInsideHits++;
    }
    if(now-(p.match.lastTraceAt||0)>=260){
      p.match.lastTraceAt=now;
      if(p.match.trace.length<260) p.match.trace.push([+p.x.toFixed(2),+p.y.toFixed(2)]);
    }

    // Robust segment advancement: crossing the end plane OR entering the next joint zone.
    // A short while-loop handles high FPS drops without skipping/sticking.
    let advances=0;
    while(p.seg<segs.length-1 && advances<3){
      const cs=segs[p.seg];
      const rx=p.x-cs.a[0], ry=p.y-cs.a[1];
      const alongPx=rx*cs.ux+ry*cs.uy;
      const endDx=p.x-cs.b[0], endDy=p.y-cs.b[1];
      const nearEnd=endDx*endDx+endDy*endDy<11.56;
      const horizontal503=Math.abs(cs.ux)>=.88;
      const advanceFrac503=horizontal503?0.985:0.91;
      const nearEndAllowed503=horizontal503
        ? (endDx*endDx+endDy*endDy<2.25)
        : nearEnd;
      if(alongPx>=cs.L*advanceFrac503 || nearEndAllowed503){
        p.seg++;
        advances++;
      } else break;
    }

    // Final section: once the finish gate is reached/passed, finish immediately.
    const last=route[route.length-1];
    const fs=segs[segs.length-1];
    const frx=p.x-fs.a[0], fry=p.y-fs.a[1];
    const finishAlong=frx*fs.ux+fry*fs.uy;
    const finishDx=p.x-last[0], finishDy=p.y-last[1];
    if(p.seg>=segs.length-1 && (finishAlong>=fs.L*0.88 || finishDx*finishDx+finishDy*finishDy<38.44)){
      p.done=true;

      // v2.29 sub-tick finish interpolation. Simulation remains 50Hz, but the
      // crossing time is estimated inside the final 20ms step for millisecond results.
      const gateAlong=fs.L*.88;
      const prevX=p.match.lastX, prevY=p.match.lastY;
      const prevAlong=(prevX-fs.a[0])*fs.ux+(prevY-fs.a[1])*fs.uy;
      const curAlong=finishAlong;
      let crossFrac=1;
      if(curAlong>prevAlong+.0001 && prevAlong<gateAlong && curAlong>=gateAlong){
        crossFrac=Math.max(0,Math.min(1,(gateAlong-prevAlong)/(curAlong-prevAlong)));
      }
      const preciseNow=now-dt*(1-crossFrac);
      p.finishTime=Math.max(0,preciseNow-raceStart);
      registerFinishRecord(p,p.finishTime);
      const finished=players.filter(q=>q.done&&q.finishTime!=null).sort((a,b)=>a.finishTime-b.finishTime);
      if(finished.length===1)setBroadcastStory(`finish-${p.index}`,"FINISH",`${p.name} 1위 확정`,formatTime(p.finishTime),now,2400);
      else if(finished.length===2){
        const gap=Math.abs(finished[1].finishTime-finished[0].finishTime);
        if(gap<=500){
          const tier=gap<=10?"DEAD HEAT":gap<=50?"ULTRA PHOTO":gap<=150?"PHOTO FINISH":"CLOSE FINISH";
          setBroadcastStory(`photo-live-${finished[0].index}-${finished[1].index}`,tier,
            `${finished[0].name} vs ${finished[1].name}`,`+${(gap/1000).toFixed(3)}s`,now,3000);
        }
      }
      return;
    }

    rescueIfStuck(p,now);

    // v2.50 danger + near miss telemetry.
    if(!safeAt(p.x,p.y)){let nearestObsSq=Infinity;for(const o of playerNearbyObservers(p,3)){const dx=p.x-o.x,dy=p.y-o.y,d2=dx*dx+dy*dy;if(d2<nearestObsSq)nearestObsSq=d2;}if(nearestObsSq<10.24)p.match.dangerExposureMs+=dt;const hitSq=PLAYER_HIT_RADIUS*PLAYER_HIT_RADIUS;if(nearestObsSq>hitSq&&nearestObsSq<1.1664&&now-(p.match.lastNearMissAt||0)>420){p.match.nearMisses++;if(nearestObsSq<.3844)p.match.extremeNearMisses++;p.match.lastNearMissAt=now;addAutoHighlight("NEAR_MISS",`NEAR MISS · ${p.name}`,now,p.index,nearestObsSq<.3844?2:1);}}

    // Players are non-solid and may overlap completely.
    // Collision here is observer-only: player-player contact never pushes, slows, or stops anyone.
    // Collision check: actual observer contact = guaranteed stop outside invincible safe zones.
    if(!safeAt(p.x,p.y) && now>=p.invUntil && now>=p.collisionLockUntil){
      for(const o of playerNearbyObservers(p,PLAYER_HIT_RADIUS+1.0)){
        const observerStep=Math.hypot(o.x-(o.simPrevX??o.x),o.y-(o.simPrevY??o.y));
        const broad=PLAYER_HIT_RADIUS+Math.hypot(p.x-p.simPrevX,p.y-p.simPrevY)+observerStep+.18;
        const opx=o.simPrevX??o.x, opy=o.simPrevY??o.y;
        const xFar=Math.abs(o.x-p.x)>broad && Math.abs(o.x-p.simPrevX)>broad &&
          Math.abs(opx-p.x)>broad && Math.abs(opx-p.simPrevX)>broad;
        const yFar=Math.abs(o.y-p.y)>broad && Math.abs(o.y-p.simPrevY)>broad &&
          Math.abs(opy-p.y)>broad && Math.abs(opy-p.simPrevY)>broad;
        if(xFar||yFar) continue;
        if(playerObserverHit(p,o)){
          p.hits++;
          p.hitFxUntil=0;
          p.dead=true;
          p.match.collisions++;
          p.match.deathPoints.push({
            round:currentRound,
            t:Math.max(0,now-raceStart),
            progressPct:+(100*Math.max(0,Math.min(1,currentProgress(p)/routeLength))).toFixed(1),
            x:+p.x.toFixed(2),y:+p.y.toFixed(2),
            ...deathCauseSnapshot(p,now,o)
          });
          triggerFollowerShockAvoid(p,o,now);
          p.cleanConfidenceMs=0;
          p.cleanConfidence=0;
          p.continuousRunMs=0;
          p.continuousRunMul=1;
          p.lastAdvanceAt=p.stunUntil;
          p.avoidPlanUntil=0;
          break;
        }
      }
    }
    enforceRoadPosition619(p);
    enforceProtectedClimb635(p);
  }

  // v4.59.9 rolling AI death blackbox. Keeps only the last ~5.5 seconds.
  function recordAiBlackboxSample(p,now,plannedX,plannedY){
    if(now<(p.aiBlackboxNextSample||0)) return;
    p.aiBlackboxNextSample=now+120;
    if(!Array.isArray(p.aiBlackbox)) p.aiBlackbox=[];
    const seen=playerPerceivedObservers(p,28);
    let close7=0, front12=0;
    const si=Math.min(p.seg,segs.length-1), seg=segs[si];
    const fx=seg?.ux||0, fy=seg?.uy||0;
    for(const o of seen){
      const dx=o.x-p.x,dy=o.y-p.y,d=Math.hypot(dx,dy);
      if(d<7) close7++;
      if(d<12 && dx*fx+dy*fy>0) front12++;
    }
    p.aiBlackbox.push({
      t:Math.round(now),x:+p.x.toFixed(2),y:+p.y.toFixed(2),
      plannedX:+plannedX.toFixed(2),plannedY:+plannedY.toFixed(2),
      heldX:+(p.mouseTargetX??p.x).toFixed(2),heldY:+(p.mouseTargetY??p.y).toFixed(2),
      mode:p.mouseMode||'race',action:p.liveEvadeAction||'none',threat:p.liveEvadeThreat??-1,
      danger:+(p.liveEvadeDanger||0).toFixed(3),tier:p.dangerTier||0,
      perceived28:seen.length,close7,front12,
      reactionPending:!!p.reactionDangerActive && (p.mouseReactionReadyAt||0)>now,
      routeBreak:!!p.routeBreakForceClick,combat:now<(p.routeBreakCombatUntil||0),
      committed:now<(p.committedEscapeUntil||0),commitSide:p.committedEscapeSide||0,hardRouteLock:now<(p.hardRouteLockUntil||0),lockedOffset:Number.isFinite(p.lockedEscapeOffset)?+p.lockedEscapeOffset.toFixed(2):null
    });
    const cutoff=now-5500;
    while(p.aiBlackbox.length && p.aiBlackbox[0].t<cutoff) p.aiBlackbox.shift();
  }

  function summarizeAiBlackbox(p,now){
    const samples=(Array.isArray(p.aiBlackbox)?p.aiBlackbox:[]).filter(x=>x.t>=now-5000);
    const clicks=(Array.isArray(p.mouseClickLog)?p.mouseClickLog:[]).filter(x=>x.t>=now-5000);
    const modeCounts={}; for(const c of clicks) modeCounts[c.mode]=(modeCounts[c.mode]||0)+1;
    let maxSeen=0,maxDanger=0,routeBreakFrames=0,commitFrames=0,reactionPendingFrames=0;
    for(const x of samples){maxSeen=Math.max(maxSeen,x.perceived28||0);maxDanger=Math.max(maxDanger,x.danger||0);if(x.routeBreak)routeBreakFrames++;if(x.committed)commitFrames++;if(x.reactionPending)reactionPendingFrames++;}
    return {
      windowMs:5000,sampleCount:samples.length,clickCount:clicks.length,modeCounts,
      maxSeen,maxDanger:+maxDanger.toFixed(3),routeBreakFrames,commitFrames,reactionPendingFrames,
      lastClicks:clicks.slice(-14).map(c=>({...c,ageMs:Math.round(now-c.t)})),
      trace:samples.slice(-46)
    };
  }

  // v4.42 DEATH-CAUSE ANALYSIS:
  // Capture what the racer actually knew/did immediately before death. This is
  // diagnostic telemetry only; it never changes movement, collision, or survival.
  function deathCauseSnapshot(p,now,hitObserver=null,forcedCause=null){
    const si=Math.min(p.seg,segs.length-1), s=segs[si];
    const recent=(Array.isArray(p.mouseClickLog)&&p.mouseClickLog.length)?p.mouseClickLog[p.mouseClickLog.length-1]:null;
    const clickAge=recent?Math.max(0,now-recent.t):null;
    const perceived=playerPerceivedObservers(p,12.5);
    let close=0, veryClose=0;
    for(const o of perceived){
      const d=Math.hypot(o.x-p.x,o.y-p.y);
      if(d<7.0) close++;
      if(d<3.2) veryClose++;
    }
    const lat=(p.x-s.a[0])*s.nx+(p.y-s.a[1])*s.ny;
    const roadHalf=Math.max(1.8,widths[si]*ROAD_MARGIN);
    const rejoin=/recover/.test(p.liveEvadeAction||'');
    const reacting=!!p.reactionDangerActive;
    const reactionPending=reacting && (p.mouseReactionReadyAt||0)>now;
    let cause=forcedCause;
    if(!cause){
      if(veryClose>=3 || close>=4) cause='SURROUNDED';
      else if(rejoin) cause='EARLY_REJOIN';
      else if(reactionPending) cause='LATE_REACTION';
      else if((p.mouseMode||'race')==='race' && close>0) cause='NO_EVADE';
      else if(recent && recent.mode!=='race' && clickAge!=null && clickAge<950) cause='WRONG_EVADE';
      else if(perceived.length===0) cause='MISSED_PERCEPTION';
      else cause='CONTACT';
    }
    return {
      cause,
      lastClick:recent?{ageMs:Math.round(clickAge),x:recent.x,y:recent.y,mode:recent.mode,threatId:recent.threatId}:null,
      mouseMode:p.mouseMode||'race', evadeAction:p.liveEvadeAction||'none',
      dangerTier:p.dangerTier||0, reactionPending,
      perceived12:perceived.length, close7:close, veryClose3:veryClose,
      lateral:+lat.toFixed(2), roadHalf:+roadHalf.toFixed(2),
      hitObserver:hitObserver?{id:hitObserver.index??hitObserver.id??-1,x:+hitObserver.x.toFixed(2),y:+hitObserver.y.toFixed(2)}:null,
      blackbox:summarizeAiBlackbox(p,now)
    };
  }

  const DEATH_CAUSE_KO={
    OUTSIDE:'코스 이탈',SURROUNDED:'다중 포위',EARLY_REJOIN:'너무 빠른 복귀',
    LATE_REACTION:'반응 지연',NO_EVADE:'회피 시작 지연',WRONG_EVADE:'잘못된 회피 방향',
    MISSED_PERCEPTION:'인지 실패',CONTACT:'접촉'
  };

  function triggerFollowerShockAvoid(hitPlayer,observer,now){
    const hitProg=currentProgress(hitPlayer);
    for(const q of players){
      if(q===hitPlayer||q.done||now<q.stunUntil) continue;
      const gap=hitProg-currentProgress(q);
      if(gap<=0||gap>3.8) continue;
      const s=segs[Math.min(q.seg,segs.length-1)];
      const dx=observer.x-q.x,dy=observer.y-q.y;
      const lat=dx*s.nx+dy*s.ny;
      const half=Math.max(2.2,widths[Math.min(q.seg,widths.length-1)]*.55);
      // Not every follower reacts perfectly: roughly 40%, scaled by prediction/reaction.
      const skill=((q.stats.prediction+q.stats.reaction)-144)/54;
      if(Math.random()>.24+Math.max(0,Math.min(1,skill))*.30) continue;
      const side=lat>=0?-1:1;
      q.shockAvoidOffset=side*half*.88;
      q.shockAvoidUntil=now+420+Math.random()*220;
      q.avoidPlanUntil=0;
      q.decisionLockUntil=0;
      q.match.avoids++;
      addAutoHighlight("FOLLOWER_SAVE",`${q.name} · 앞선수 충돌 보고 긴급 회피`,now,q.index,2);
    }
  }

  function updateObservers(now,dt=16){
    const sec=Math.min(0.05,Math.max(0,dt/1000));
    const margin=2.8;

    for(let oi=0;oi<observers.length;oi++){
      const o=observers[oi];
      // v3.7: retain the exact previous simulation position for relative swept collision.
      o.simPrevX=o.x; o.simPrevY=o.y;
      if(!o.phaseUntil){
        const offset=o.cycleOffset||0;
        if(offset<OBS_MOVE_MS){
          o.phase="move";
          o.phaseUntil=now+(OBS_MOVE_MS-offset);
        }else{
          o.phase="stop";
          o.phaseUntil=now+(OBS_MOVE_MS+OBS_STOP_MS-offset);
          o.vx=0; o.vy=0;
        }
        o.cycleOffset=0;
      }

      if(now>=o.phaseUntil){
        if(o.phase==="move"){
          o.phase="stop";
          o.phaseUntil=now+OBS_STOP_MS;
          o.vx=0; o.vy=0;
        }else{
          o.phase="move";
          o.phaseUntil=now+OBS_MOVE_MS;
          o.speed=(9.72*OBS_SPEED_RATIO)*(0.98+Math.random()*0.04);
          pickObserverLeg(o);
        }
      }

      if(o.phase==="move"){
        o.x+=o.vx*sec;
        o.y+=o.vy*sec;

        // Safety only: keep the observer inside the map. The selected leg normally
        // avoids these borders, so direction changes occur after the 1-second stop.
        if(o.x<margin){ o.x=margin; o.vx=Math.abs(o.vx); }
        else if(o.x>MAP_W-margin){ o.x=MAP_W-margin; o.vx=-Math.abs(o.vx); }
        if(o.y<margin){ o.y=margin; o.vy=Math.abs(o.vy); }
        else if(o.y>MAP_H-margin){ o.y=MAP_H-margin; o.vy=-Math.abs(o.vy); }
      }
    }
  }

  let cameraLeaderId=-1;
  let cameraLeaderHoldUntil=0;
  let lastRankingRender=0;
  let lastVisibleObs=0;
  let lastLeaderName="";
  let raceEventText="";
  let raceEventUntil=0;
  let broadcastFocusId=-1;
  let broadcastFocusUntil=0;
  let previousUiRanks=new Map();
  let diagFrames=0, diagFps=0, diagLastFpsTs=0, diagFrameMs=0, diagMaxFrameMs=0;
  let fpsProtectLevel=0, fpsLowSince=0, fpsGoodSince=0;
  function updateFpsProtection(now){
    if(!running) return;
    if(diagFps>0 && diagFps<42){
      fpsGoodSince=0;
      fpsLowSince=fpsLowSince||now;
      if(now-fpsLowSince>1600 && fpsProtectLevel<2){
        fpsProtectLevel++;
        fpsLowSince=now;
      }
    }else if(diagFps>=54){
      fpsLowSince=0;
      fpsGoodSince=fpsGoodSince||now;
      if(now-fpsGoodSince>4500 && fpsProtectLevel>0){
        fpsProtectLevel--;
        fpsGoodSince=now;
      }
    }else{
      fpsLowSince=0;fpsGoodSince=0;
    }
  }
  let raceLeaderChanges=0, raceTotalOvertakes=0;
  // v2.17 replay: lightweight snapshots of the actual live race.
  let replayFrames=[], replayLastCapture=0, replayPlaying=false, replayRaf=0;
  let replayCursor=0, replaySpeed=1, replayLastTs=0, replayFocusId=-1;
  let replayArchive={};
  let highlightMarkers=[];
  let highlightArchive={};
  let photoFinishArchive={};
  let replaySelectedRound=1;
  let lastCloseBattleKey="", lastCloseBattleEventAt=0;
  let broadcastStoryKey="", broadcastStoryUntil=0;
  let broadcastTickerUntil=0, broadcastTickerText="";
  let broadcastLastRankSnapshot=new Map();
  const SECTOR_MARKS=[0.25,0.50,0.75];
  let bestSector=[null,null,null];


  let commentaryItems=[];
  let commentaryLastKey="";
  let commentaryLastAt=0;
  let commentaryLastGeneralAt=0;

  function resetCommentary(){
    commentaryItems=[];commentaryLastKey="";commentaryLastAt=0;commentaryLastGeneralAt=0;
    const feed=document.getElementById("commentaryFeed"),lead=document.getElementById("commentaryLead"),round=document.getElementById("commentaryRound");
    if(feed) feed.innerHTML="";
    if(lead) lead.textContent="출발 준비! 선수들이 스타트 라인에 섰습니다.";
    if(round) round.textContent=`${currentRound}R`;
  }
  function commentaryLine(key,text,now=gameNow(),force=false){
    if(!force&&key===commentaryLastKey&&now-commentaryLastAt<2600)return;
    if(!force&&now-commentaryLastAt<900)return;
    commentaryLastKey=key;commentaryLastAt=now;
    commentaryItems.unshift({text,time:raceStart?Math.max(0,now-raceStart):0});
    if(commentaryItems.length>7)commentaryItems.length=7;
    const lead=document.getElementById("commentaryLead"),feed=document.getElementById("commentaryFeed");
    if(lead)lead.textContent=text;
    if(feed)feed.innerHTML=commentaryItems.map((x,i)=>`<div class="commentary-line ${i===0?"latest":""}"><span>${(x.time/1000).toFixed(1)}초</span><b>${x.text}</b></div>`).join("");
  }
  function updateLiveCommentary(now){
    const ordered=liveOrderedPlayers();if(!ordered.length)return;
    const p1=ordered[0],p2=ordered[1],p3=ordered[2],frac=Math.max(0,Math.min(1,currentProgress(p1)/routeLength));
    const g12=broadcastGapSeconds(p1,p2),g23=broadcastGapSeconds(p2,p3);
    const round=document.getElementById("commentaryRound");if(round)round.textContent=`${currentRound}R · ${(frac*100).toFixed(0)}%`;
    if(frac>.94&&g12!=null&&g12<.20){commentaryLine(`finish-${p1.index}-${p2.index}`,`${p1.name} 선두! ${p2.name}이 바로 뒤에서 결승선을 노립니다. 마지막까지 모릅니다!`,now);return;}
    if(g12!=null&&g12<.24){commentaryLine(`fight-${p1.index}-${p2.index}`,`${p1.name}과 ${p2.name}, 선두 싸움이 붙었습니다. 격차가 ${g12.toFixed(2)}초밖에 나지 않습니다!`,now);return;}
    if(g12!=null&&g23!=null&&g12<.40&&g23<.40){commentaryLine(`three-${p1.index}-${p2.index}-${p3.index}`,`상위 3명이 한 덩어리입니다. ${p1.name}, ${p2.name}, ${p3.name}! 한 번의 회피가 순위를 바꿀 수 있습니다.`,now);return;}
    let climber=null,bestGain=0;ordered.forEach((q,i)=>{const gain=(q.match?.startRank||i+1)-(i+1);if(gain>bestGain){bestGain=gain;climber=q;}});
    if(climber&&bestGain>=3){commentaryLine(`climb-${climber.index}-${bestGain}`,`${climber.name}, 출발 순위보다 ${bestGain}계단 올라왔습니다. 추월 흐름이 좋습니다!`,now);return;}
    if(now-commentaryLastGeneralAt>5200){
      commentaryLastGeneralAt=now;
      if(frac<.22)commentaryLine(`phase1-${p1.index}`,`${p1.name}이 초반 선두를 잡았습니다. 첫 코너와 옵저버 회피가 중요합니다.`,now);
      else if(frac<.55)commentaryLine(`phase2-${p1.index}`,`${p1.name}이 선두, ${p2.name}이 추격합니다. 중반부터 라인 선택 하나가 추월 기회로 이어집니다.`,now);
      else if(frac<.82)commentaryLine(`phase3-${p1.index}`,`후반으로 들어갑니다. ${p1.name}이 앞서지만 ${p2.name}도 아직 사정권입니다. 실수 한 번이면 뒤집힙니다.`,now);
      else commentaryLine(`phase4-${p1.index}`,`마지막 구간! ${p1.name}이 선두를 지킵니다. 최단 라인과 마지막 회피가 승부를 결정합니다.`,now);
    }
  }

  function liveOrderedPlayers(){
    return [...players].sort((a,b)=>{
      if(a.done&&b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      return currentProgress(b)-currentProgress(a);
    });
  }
  function broadcastGapSeconds(a,b){
    if(!a||!b) return null;
    return Math.max(0,currentProgress(a)-currentProgress(b))/Math.max(1,(a.speed+b.speed)*.5);
  }
  function setBroadcastStory(key,kicker,title,sub,now=gameNow(),hold=1800){
    const k={"NEW LEADER":"선두 교체","FINAL BATTLE":"결승선 승부","3-WAY BATTLE":"3인 접전","BIG COMEBACK":"대역전","LEADER WATCH":"선두 수성","PHOTO FINISH":"포토피니시"}[kicker]||kicker;
    commentaryLine(`story-${key}`,`${k}! ${title}${sub?` · ${sub}`:""}`,now);
  }
  function updateBroadcastFinal(now){
    const ordered=liveOrderedPlayers();if(!ordered.length)return;
    const p1=ordered[0],p2=ordered[1],p3=ordered[2],frac=Math.max(0,Math.min(1,currentProgress(p1)/routeLength));
    const g12=broadcastGapSeconds(p1,p2),g23=broadcastGapSeconds(p2,p3);
    const strip=document.getElementById("broadcastStrip");
    if(strip)strip.innerHTML=`<div><span>${frac>=.82?"마지막 구간":"실시간 선두"}</span><b>${p1.name}</b></div><div><span>1위 ↔ 2위 격차</span><b>${g12==null?"--":g12.toFixed(2)+"초"}</b></div><div><span>2위 ↔ 3위 격차</span><b>${g23==null?"--":g23.toFixed(2)+"초"}</b></div><div><span>선두 교체</span><b>${raceLeaderChanges}회</b></div>`;
    updateLiveCommentary(now);
  }

  function updateCamera(dt){
    const now=gameNow();

    // Manual POV is the only intentional override of P1 following.
    const pov=players[povPlayerIndex];
    if(povPlayerIndex>=0 && pov && !pov.done && !pov.dead){
      cameraLeaderId=pov.index;
      smoothCamera665(dt,pov.x,pov.y);
      return;
    }

    const cache=(raceFrameCache668.stamp===now)?raceFrameCache668:rebuildRaceFrameCache668(now);
    const leader=cameraSubject661(now);
    if(!leader) return;

    cameraLeaderId=leader.index;
    cameraLeaderHoldUntil=now;

    let frame=closeBattleFrame662(leader,cache);
    frame=overtakeFrame663(leader,cache,now,frame);
    frame=packFrame664(leader,cache,frame);
    smoothCamera665(dt,frame.x,frame.y);
  }

  function finalizeIndividualClear(finishers,now){
    if(roundTransitioning) return; roundTransitioning=true;
    const bestMs=Math.round(finishers[0].finishTime);
    const tied=finishers.filter(p=>Math.round(p.finishTime)===bestMs);
    tied.forEach(p=>{
      const row=playerTournament[p.index]; if(row){row.total+=1;row.rounds.push({round:currentRound,rank:1,points:1,time:p.finishTime,rating:0});}
    });
    renderPersonalScore();
    const winners=tied.map(p=>p.name).join(" · ");
    commentaryLine(`clear-${currentRound}-${bestMs}`,`${ROUND_UNIT_NAMES[currentRound]} 클리어! ${winners} +1점`,now,true);
    const champion=tied.find(p=>(playerTournament[p.index]?.total||0)>=5) || players.find(p=>(playerTournament[p.index]?.total||0)>=5);
    if(champion){
      running=false; startBtn.textContent=`우승 · ${champion.name}`;
      setBroadcastStory("champion","WINNER",`${champion.name} 개인전 우승`,`5클리어 달성`,now,999999);
      return;
    }
    setTimeout(()=>{currentRound=currentRound%5+1;resetRound();start();},900);
  }

  function restartSameIndividualRound(){
    if(roundTransitioning) return; roundTransitioning=true;
    const r=currentRound;
    setBroadcastStory(`all-dead-${r}`,"ALL OUT",`${ROUND_UNIT_NAMES[r]} 전원 사망`,`같은 라운드 재시작`,gameNow(),900);
    setTimeout(()=>{currentRound=r;resetRound();start();},900);
  }

  function finalizeRound(){
    if(roundTransitioning) return;
    roundTransitioning=true;

    const ordered=[...players].sort((a,b)=>a.finishTime-b.finishTime);
    const result={round:currentRound,team:{A:0,B:0,C:0,D:0},
      leaderChanges:raceLeaderChanges,totalOvertakes:raceTotalOvertakes,players:[]};

    ordered.forEach((p,idx)=>{
      const pts=ROUND_POINTS[idx];
      const team=p.team;
      result.team[team]+=pts;
      teamTotals[team]+=pts;
      playerTournament[p.index].total+=pts;
      playerTournament[p.index].rounds.push({
        round:currentRound,rank:idx+1,points:pts,time:p.finishTime,rating:0
      });
      result.players.push({
        index:p.index,name:p.name,team,rank:idx+1,points:pts,time:p.finishTime,
        collisions:p.match.collisions||0,
        deathPoints:(p.match.deathPoints||[]).map(d=>({...d})),
        overtakes:p.match.overtakes||0,
        avoids:p.match.avoids||0,nearMisses:p.match.nearMisses||0,extremeNearMisses:p.match.extremeNearMisses||0,dangerExposureMs:p.match.dangerExposureMs||0,
        leadMs:p.match.leadMs||0,
        controlAttempts:p.match.controlAttempts||0,
        controlSuccesses:p.match.controlSuccesses||0,
        controlByType:JSON.parse(JSON.stringify(p.match.controlByType||{})),
        passPlans:{...(p.match.passPlans||{})},
        insideRate:p.match.lineSamples?100*p.match.insideHits/p.match.lineSamples:0,
        extremeInsideRate:p.match.lineSamples?100*p.match.extremeInsideHits/p.match.lineSamples:0,
        distance:p.match.distance||0,
        efficiency:p.match.distance?100*routeLength/p.match.distance:0,
        rankGain:Math.max(0,(p.match.startRank||12)-(p.match.bestRank||12)),
        trace:(p.match.trace||[]).slice(),
        bestSector:p.sectorTimes&&p.sectorTimes.length?Math.min(...p.sectorTimes):null,
        raceForm:p.raceForm,
        startReactionMs:p.startReactionMs,
        startExecution:p.startExecution,
        rating:0
      });
    });

    for(const x of result.players){
      x.rating=roundPerformanceRating(x);
      const rr=playerTournament[x.index]?.rounds?.find(q=>q.round===currentRound);
      if(rr) rr.rating=x.rating;
    }

    replayArchive[currentRound]=replayFrames.slice();
    highlightArchive[currentRound]=highlightMarkers.slice();

    const top1=result.players[0], top2=result.players[1];
    if(top1 && top2){
      const gap=Math.abs(top2.time-top1.time);
      if(gap<=500){
        const photoTier=gap<=10?"DEAD HEAT":gap<=50?"ULTRA PHOTO":gap<=150?"PHOTO FINISH":"CLOSE FINISH";
        photoFinishArchive[currentRound]={
          gap,winner:top1.name,second:top2.name,time:top1.time,tier:photoTier,
          text:`${photoTier} · ${top1.name} vs ${top2.name} · +${(gap/1000).toFixed(3)}s`
        };
        const marker={type:"PHOTO_FINISH",text:photoFinishArchive[currentRound].text,
          t:Math.max(0,top1.time-450),playerId:top1.index,importance:3};
        highlightArchive[currentRound].push(marker);
        tournamentHighlights.push({round:currentRound,type:"PHOTO_FINISH",text:photoFinishArchive[currentRound].text});
      }
    }

    for(const x of result.players){
      const startRank=(players[x.index].match?.startRank)||12;
      const gain=startRank-x.rank;
      if(gain>=4){
        const marker={type:"COMEBACK",text:`COMEBACK · ${x.name} · ${startRank}위 → ${x.rank}위`,
          t:Math.max(0,x.time-4500),playerId:x.index,importance:3};
        highlightArchive[currentRound].push(marker);
        tournamentHighlights.push({round:currentRound,type:"COMEBACK",text:marker.text});
      }
    }

    const roundWinner=result.players[0];
    if(roundWinner){
      tournamentHighlights.push({round:currentRound,type:"WIN",text:`WIN · ${roundWinner.name} · ${formatTime(roundWinner.time)}`});
    }
    const topPass=[...result.players].sort((a,b)=>b.overtakes-a.overtakes || a.rank-b.rank)[0];
    if(topPass&&topPass.overtakes>0){
      tournamentHighlights.push({round:currentRound,type:"OVERTAKE",text:`BEST OVERTAKE · ${topPass.name} · ${topPass.overtakes}회`});
    }
    const clean=[...result.players].filter(x=>x.collisions===0).sort((a,b)=>a.rank-b.rank)[0];
    if(clean){
      tournamentHighlights.push({round:currentRound,type:"CLEAN",text:`무충돌 베스트 · ${clean.name} · 무충돌 ${clean.rank}위`});
    }

    roundHistory.push(result);
    rebuildTournamentStandings();
    recordLiveBalanceRound(result);
    renderTeamScore();

    if(currentRound<5){
      startBtn.textContent=`${currentRound}R 종료`;
      setTimeout(()=>{
        currentRound++;
        resetRound();
        start();
      },1200);
    }else{
      running=false;
      recordSeasonResults();
      publishMasterResult();
      startBtn.textContent="5R 경기 종료";
      setTimeout(showMatchResults,350);
    }
  }

  function renderTeamScore(){
    const el=document.getElementById("teamScoreBoard"); if(el) el.style.display="none";
    renderPersonalScore();
  }

  function renderPersonalScore(){
    const el=document.getElementById("personalScoreBoard"); if(!el) return;
    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    el.innerHTML=`<div class="personal-score-title">개인 클리어 점수 · 5점 선승</div>`+
      rows.map((pt,i)=>`<div class="personal-score-row"><span class="personal-rank">${i+1}</span><span class="score-dot" style="background:${teamColor(pt.team)}"></span><span class="personal-name">${pt.name}</span><b>${pt.total}</b></div>`).join("");
  }

  function qaRuntimeStatus(){
    const issues=[];
    if(observers.length!==OBSERVER_COUNT) issues.push(`옵저버 ${observers.length}/${OBSERVER_COUNT}`);
    if(players.length!==8) issues.push(`선수 ${players.length}/8`);
    if(CAMERA_ZOOM!==3.0) issues.push(`카메라 ${CAMERA_ZOOM}`);
    if(Math.abs(PLAYER_HIT_RADIUS-.56)>.0001) issues.push(`충돌범위 ${PLAYER_HIT_RADIUS}`);
    if(Math.abs(SIM_STEP_MS-20)>.001) issues.push(`SIM ${SIM_STEP_MS.toFixed(1)}`);
    if(STUN_MS!==0) issues.push(`STUN ${STUN_MS}`);
    if(INV_MS!==0) issues.push(`INV ${INV_MS}`);
    if(Math.abs(ROAD_MARGIN-1.10)>.0001) issues.push(`ROAD ${ROAD_MARGIN}`);
    if(Math.abs(DEATH_EDGE_EXTRA-4.50)>.0001) issues.push(`EDGE ${DEATH_EDGE_EXTRA}`);
    return issues.length?`QA CHECK ${issues.join("·")}`:"정상";
  }

  function renderDiagnostics(){
    const el=document.getElementById("diagnostics");
    if(!el || el.classList.contains("hidden")) return;
    let collisions=0,finishes=0,totalTime=0;
    for(const p of players){collisions+=p.match.collisions||0;if(p.done&&p.finishTime!=null){finishes++;totalTime+=p.finishTime;}}
    const avg=finishes?formatTime(totalTime/finishes):"--";
    const alive=players.filter(p=>!p.dead&&!p.done);
    const clicks=players.reduce((n,p)=>n+(p.mouseClickSeq||0),0);
    const stops=players.reduce((n,p)=>n+((p.mouseClickLog||[]).filter(c=>c.mode==='stop').length),0);
    const evadeClicks=players.reduce((n,p)=>n+((p.mouseClickLog||[]).filter(c=>c.mode&&c.mode!=='race').length),0);
    const redundant=players.reduce((n,p)=>n+(p.aiDiagRedundantClicks||0),0);
    const modeChanges=players.reduce((n,p)=>n+(p.aiDiagModeChanges||0),0);
    const avgReaction=players.length?players.reduce((n,p)=>n+(p.lastReactionDelayMs||0),0)/players.length:0;
    const elapsedSec=Math.max(1,((gameNow()-(raceStart||gameNow()))/1000));
    const clickRate=clicks/elapsedSec/Math.max(1,players.length);
    const stopRate=clicks?stops/clicks*100:0;
    const warnings=[];
    if(clickRate>5.0) warnings.push('과다 클릭');
    if(stopRate>5.0) warnings.push('스탑 과다');
    if(redundant>Math.max(8,clicks*.12)) warnings.push('중복 클릭');
    if(modeChanges>Math.max(12,clicks*.22)) warnings.push('판단 전환 과다');
    el.innerHTML=`<b>v4.30 AI 진단</b><br>FPS ${diagFps.toFixed(0)} · frame ${diagFrameMs.toFixed(1)}ms · max ${diagMaxFrameMs.toFixed(1)}ms · 자동보호 ${fpsProtectLevel}<br>생존 ${alive.length}/8 · 옵저버 ${observers.length} · 충돌 ${collisions} · 완주 ${finishes}/8 · 평균 ${avg}<br>클릭 ${clicks} · 1인 초당 ${clickRate.toFixed(2)} · 회피클릭 ${evadeClicks} · 스탑 ${stops} (${stopRate.toFixed(1)}%)<br>평균 최근 반응 ${avgReaction.toFixed(0)}ms · 중복클릭 ${redundant} · 행동전환 ${modeChanges}<br>${warnings.length?`⚠ ${warnings.join(' · ')}`:'AI 입력 진단 정상'}`;
  }

  const SIM_STEP_MS = 1000/50;
  const MAX_SIM_STEPS = 6;
  let simClock=0;
  let simTickCounter=0;
  let simAccumulator=0;
  function gameNow(){
    return (running && raceStart && simClock) ? simClock : performance.now();
  }


  function captureReplayFrame(now){
    if(!raceStart || now-replayLastCapture<190) return; // ~5.9 fps replay data
    replayLastCapture=now;
    if(replayFrames.length>=560) return;
    replayFrames.push({
      t:Math.max(0,now-raceStart),
      p:players.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2),p.done?1:0,currentProgress(p)]),
      leader:(()=>{
        let id=0,best=-1;
        for(let i=0;i<players.length;i++){
          const pr=currentProgress(players[i]);
          if(pr>best){best=pr;id=i;}
        }
        return id;
      })()
    });
  }

  function activeReplayFrames(){
    return replayArchive[replaySelectedRound] || replayFrames;
  }

  function replayDuration(){
    const frames=activeReplayFrames();
    return frames.length?frames[frames.length-1].t:0;
  }

  function replayFrameAt(ms){
    const frames=activeReplayFrames();
    if(!frames.length) return null;
    let lo=0,hi=frames.length-1;
    while(lo<hi){
      const mid=(lo+hi+1)>>1;
      if(frames[mid].t<=ms) lo=mid; else hi=mid-1;
    }
    return frames[lo];
  }

  function drawReplayFrame(frame){
    const rc=document.getElementById("replayCanvas");
    if(!rc||!frame) return;
    const rctx=rc.getContext("2d");
    rctx.clearRect(0,0,rc.width,rc.height);
    if(map.complete) rctx.drawImage(map,0,0,rc.width,rc.height);
    const sx=rc.width/MAP_W, sy=rc.height/MAP_H;
    const focus=replayFocusId>=0?replayFocusId:frame.leader;
    for(let i=0;i<frame.p.length;i++){
      const q=frame.p[i], p=players[i];
      const x=q[0]*sx, y=q[1]*sy, focused=i===focus;
      rctx.beginPath();
      rctx.arc(x,y,focused?5.8:3.9,0,Math.PI*2);
      rctx.fillStyle=teamColor(p.team);
      rctx.fill();
      rctx.strokeStyle=focused?"#ffffff":"#07111a";
      rctx.lineWidth=focused?2.2:1.2;
      rctx.stroke();

      rctx.font=`${focused?"800":"700"} 10px system-ui`;
      rctx.textAlign="left";
      rctx.textBaseline="middle";
      rctx.lineWidth=3;
      rctx.strokeStyle="rgba(0,0,0,.92)";
      rctx.strokeText(p.name,x+6,y-6);
      rctx.fillStyle="#ffffff";
      rctx.fillText(p.name,x+6,y-6);
    }
    const time=document.getElementById("replayTime");
    if(time) time.textContent=`${formatTime(replayCursor)} / ${formatTime(replayDuration())}`;
  }

  function setReplayCursor(ms){
    replayCursor=Math.max(0,Math.min(replayDuration(),ms));
    const slider=document.getElementById("replaySlider");
    if(slider) slider.value=String(replayCursor);
    drawReplayFrame(replayFrameAt(replayCursor));
  }

  function replayLoop(ts){
    if(!replayPlaying) return;
    if(!replayLastTs) replayLastTs=ts;
    const dt=ts-replayLastTs; replayLastTs=ts;
    replaySpeed=1; setReplayCursor(replayCursor+dt);
    if(replayCursor>=replayDuration()){
      replayPlaying=false;
      const b=document.getElementById("replayPlay");
      if(b) b.textContent="▶ 재생";
      return;
    }
    replayRaf=requestAnimationFrame(replayLoop);
  }

  function openReplay(roundOverride=null,seekMs=null,slow=false){
    const available=Object.keys(replayArchive).map(Number).sort((a,b)=>a-b);
    if(!available.length && !replayFrames.length) return;
    replaySelectedRound=roundOverride || available[available.length-1] || currentRound;
    const panel=document.getElementById("replayPanel");
    const slider=document.getElementById("replaySlider");
    const picks=document.getElementById("replayFocus");
    const rounds=document.getElementById("replayRounds");
    const hl=document.getElementById("replayHighlights");

    function renderReplayHighlights(){
      if(!hl) return;
      const markers=[...(highlightArchive[replaySelectedRound]||[])]
        .sort((a,b)=>b.importance-a.importance||a.t-b.t).slice(0,12);
      hl.innerHTML=markers.length
        ? markers.map((h,i)=>`<button class="highlight-jump" data-hi="${i}"><b>${highlightTypeLabel(h.type)}</b><span>${h.text}</span></button>`).join("")
        : `<span class="highlight-empty">자동 감지 하이라이트 없음</span>`;
      hl.querySelectorAll("[data-hi]").forEach(b=>{
        const h=markers[Number(b.dataset.hi)];
        b.addEventListener("click",()=>{
          replayFocusId=h.playerId??-1;
          replaySpeed=1;
          setReplayCursor(Math.max(0,h.t-1400));
        });
      });
    }

    if(rounds){
      rounds.innerHTML=available.map(r=>`<button data-replay-round="${r}">${r}R</button>`).join("");
      rounds.querySelectorAll("[data-replay-round]").forEach(b=>b.addEventListener("click",()=>{
        replaySelectedRound=Number(b.dataset.replayRound);
        replayPlaying=false;
        document.getElementById("replayPlay").textContent="▶ 재생";
        if(slider) slider.max=String(replayDuration());
        renderReplayHighlights();
        setReplayCursor(0);
      }));
    }

    if(slider){slider.max=String(replayDuration());slider.step="50";}
    if(picks){
      picks.innerHTML=`<button data-focus="-1">선두 자동</button>`+
        players.map(p=>`<button data-focus="${p.index}">${p.name}</button>`).join("");
      picks.querySelectorAll("[data-focus]").forEach(b=>b.addEventListener("click",()=>{
        replayFocusId=Number(b.dataset.focus);
        drawReplayFrame(replayFrameAt(replayCursor));
      }));
    }
    renderReplayHighlights();
    replaySpeed=1;
    setReplayCursor(seekMs==null?0:seekMs);
    panel.classList.remove("hidden");
  }

  function simulateStep(now,dt){
    updateObservers(now,dt);
    playerNearbyFrameSerial++;
    simTickCounter++;

    // v3.6: 330-observer optimization — lighter lookup/prediction work; collisions remain 50Hz.
    // Explicit ticks avoid duplicate refreshes caused by timestamp rounding.
    if(simTickCounter>=14){
      simTickCounter=0;
      rebuildObserverGrid();
      precomputeObserverPredictions(now);
    }

    for(let i=0;i<players.length;i++){
      sanitizeRaceState666(players[i]);
      updatePlayer(players[i],now,dt);
      sanitizeRaceState666(players[i]);
    }
    rebuildRaceFrameCache668(now);
    updateCamera(dt);
    captureReplayFrame(now);
  }

  function loop(ts){
    if(!running) return;

    let frameDelta=ts-lastTs;
    lastTs=ts;
    diagFrameMs=frameDelta; diagMaxFrameMs=Math.max(diagMaxFrameMs,frameDelta); diagFrames++;
    if(!diagLastFpsTs) diagLastFpsTs=ts;
    if(ts-diagLastFpsTs>=1000){
      diagFps=diagFrames*1000/(ts-diagLastFpsTs);diagFrames=0;diagLastFpsTs=ts;
      updateFpsProtection(ts);
    }
    if(frameDelta<0) frameDelta=0;
    if(frameDelta>80) frameDelta=80;
    simAccumulator+=frameDelta;

    if(!simClock) simClock=ts-simAccumulator;

    let steps=0;
    while(simAccumulator>=SIM_STEP_MS && steps<MAX_SIM_STEPS){
      simClock+=SIM_STEP_MS;
      simulateStep(simClock,SIM_STEP_MS);
      simAccumulator-=SIM_STEP_MS;
      steps++;
    }

    // Never allow a backlog to grow for seconds after a browser/GC stall.
    if(simAccumulator>SIM_STEP_MS*6) simAccumulator=SIM_STEP_MS*6;

    render(ts);

    const rankingInterval=fpsProtectLevel===0?320:fpsProtectLevel===1?430:560;
    if(ts-lastRankingRender>=rankingInterval){
      const rankingDt=ts-lastRankingRender;
      updateMatchRanks(rankingDt,simClock||ts);
      updateSectors(simClock||ts);
      renderRanking();
      const raceEvent=document.getElementById("raceEvent");
      if(raceEvent && ts>=raceEventUntil) raceEvent.classList.add("hidden");
      const leadBattle=document.getElementById("leadBattle");
      if(leadBattle){
        const battle=chooseBroadcastBattle();
        if(battle){
          const gap=Math.abs(currentProgress(battle.a)-currentProgress(battle.b));
          const secGap=gap/Math.max(1,battle.a.speed||1);
          leadBattle.textContent=`${battle.label} · ${battle.a.name} / ${battle.b.name} · ${secGap.toFixed(2)}s`;
          leadBattle.classList.remove("hidden");
          const battleKey=`${battle.label}:${battle.a.index}:${battle.b.index}`;
          if(battle.label==="CLOSE BATTLE" &&
             battleKey!==lastCloseBattleKey &&
             ts-lastCloseBattleEventAt>3000){
            pushRaceEvent(`CLOSE BATTLE · ${battle.a.name} / ${battle.b.name}`,ts);
            lastCloseBattleKey=battleKey;
            lastCloseBattleEventAt=ts;
          }
        }else leadBattle.classList.add("hidden");
      }
      cameraLabel.textContent=`${BUILD_ID} · ${ROUND_UNIT_NAMES[currentRound]} · 옵저버 ${observers.length} · 충돌범위 ${PLAYER_HIT_RADIUS.toFixed(2)}`;
      renderDiagnostics();
      // v3.2 upper broadcast/leader-change strip removed.
      lastRankingRender=ts;
    }

    const roundFinishers=players.filter(p=>p.done&&p.finishTime!=null).sort((a,b)=>a.finishTime-b.finishTime);
    if(roundFinishers.length){
      running=false;
      finalizeIndividualClear(roundFinishers,ts);
      return;
    }
    if(players.every(p=>p.dead)){
      running=false;
      restartSameIndividualRound();
      return;
    }

    if(false && players.every(p=>p.done)){
      const fin=[...players].sort((a,b)=>a.finishTime-b.finishTime);
      if(fin[0])commentaryLine(`round-finish-${currentRound}`,`${currentRound}라운드 종료! ${fin[0].name}이 1위로 결승선을 통과했습니다.`,ts,true);
      running=false;
      finalizeRound();
      return;
    }
    raf=requestAnimationFrame(loop);
  }


  function getView(){
    const W=canvas.width,H=canvas.height;
    const fitScale=Math.min(W/MAP_W,H/MAP_H);
    const scale=fitScale*CAMERA_ZOOM;
    const viewW=W/scale, viewH=H/scale;
    let sx=camX-viewW/2, sy=camY-viewH/2;
    sx=Math.max(0,Math.min(MAP_W-viewW,sx));
    sy=Math.max(0,Math.min(MAP_H-viewH,sy));
    return {sx,sy,viewW,viewH,scale};
  }

  const visibleObserverRender=[];
  function drawObservers(view){
    const pad=5;
    const minX=view.sx-pad, maxX=view.sx+view.viewW+pad;
    const minY=view.sy-pad, maxY=view.sy+view.viewH+pad;
    const r=Math.max(2.142,view.scale*0.72*OBS_VISUAL_SCALE);
    // v4.31: observer visual is circular again. Visual aspect ratio and collision
    // semantics are both symmetric; HIT remains controlled separately by PLAYER_HIT_RADIUS.
    const obsRx=r, obsRy=r;
    const lineW=Math.max(0.714,view.scale*.11*OBS_VISUAL_SCALE);

    // v2.31: use the already-maintained observer spatial grid for render culling.
    // We visit only buckets intersecting the camera instead of checking all 600.
    visibleObserverRender.length=0;
    // v2.40: one-cell render padding prevents edge flicker while still
    // avoiding a full 650-observer scan every frame.
    const gx0=Math.max(0,Math.floor(minX/OBS_GRID_SIZE)-1);
    const gx1=Math.min(OBS_GRID_COLS-1,Math.floor(maxX/OBS_GRID_SIZE)+1);
    const gy0=Math.max(0,Math.floor(minY/OBS_GRID_SIZE)-1);
    const gy1=Math.min(OBS_GRID_ROWS-1,Math.floor(maxY/OBS_GRID_SIZE)+1);
    for(let gy=gy0;gy<=gy1;gy++){
      for(let gx=gx0;gx<=gx1;gx++){
        const bucket=observerGrid[gy*OBS_GRID_COLS+gx];
        for(let bi=0;bi<bucket.length;bi++){
          const o=bucket[bi];
          if(o.x<minX||o.x>maxX||o.y<minY||o.y>maxY) continue;
          visibleObserverRender.push(o);
        }
      }
    }

    const obsRenderStep=fpsProtectLevel===0?1:fpsProtectLevel===1?2:3;
    ctx.beginPath();
    for(let vi=0;vi<visibleObserverRender.length;vi+=obsRenderStep){
      const o=visibleObserverRender[vi];
      const x=(o.x-view.sx)*view.scale;
      const y=(o.y-view.sy)*view.scale;
      ctx.moveTo(x+obsRx,y);
      ctx.ellipse(x,y,obsRx,obsRy,0,0,Math.PI*2);
    }
    ctx.fillStyle="#d6e8ff";
    ctx.fill();
    ctx.strokeStyle="#5f89ad";
    ctx.lineWidth=lineW;
    ctx.stroke();

    ctx.beginPath();
    for(let vi=0;vi<visibleObserverRender.length;vi+=obsRenderStep){
      const o=visibleObserverRender[vi];
      const x=(o.x-view.sx)*view.scale;
      const y=(o.y-view.sy)*view.scale;
      ctx.moveTo(x+r*.62,y);
      ctx.arc(x+r*.18,y,r*.28,0,Math.PI*2);
    }
    ctx.fillStyle="#83bcdf";
    ctx.fill();

    return Math.ceil(visibleObserverRender.length/obsRenderStep);
  }

  function drawPlayer(p,view,rank){
    const x=(p.x-view.sx)*view.scale, y=(p.y-view.sy)*view.scale;
    if(x<-80||y<-80||x>canvas.width+80||y>canvas.height+80) return;
    const r=Math.max(8.6846,view.scale*1.48*PLAYER_VISUAL_SCALE);

    const now=gameNow();
    const mdx=p.x-p.prevX, mdy=p.y-p.prevY;
    if(mdx*mdx+mdy*mdy>0.0004){
      const targetAngle=Math.atan2(mdy,mdx)+Math.PI/2;
      let da=targetAngle-p.visualAngle;
      while(da>Math.PI) da-=Math.PI*2;
      while(da<-Math.PI) da+=Math.PI*2;
      p.visualAngle+=da*0.12;
      p.prevX=p.x; p.prevY=p.y;
    }

    ctx.save();
    ctx.translate(x,y);


    if(now<p.invUntil){
      ctx.globalAlpha=.48+.35*Math.abs(Math.sin(gameNow()*.018));
      ctx.strokeStyle="#fff";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r*1.45,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=1;
    }

    // v3.7 Marseille visual cue: short curved after-image + extra body rotation.
    // It is intentionally subtle and exists only while the real control is active.
    let marseilleVisualSpin=0;
    if(p.controlMode==="marseille" && now<p.marseilleUntil){
      const dur=Math.max(1,p.controlUntil-p.modeStart);
      const mt=Math.max(0,Math.min(1,(now-p.modeStart)/dur));
      marseilleVisualSpin=p.marseilleSide*Math.sin(mt*Math.PI)*1.05;
      ctx.save();
      ctx.globalAlpha=.16+.18*Math.sin(mt*Math.PI);
      ctx.strokeStyle=teamColor(p.team);
      ctx.lineWidth=Math.max(2,r*.22);
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.arc(-p.marseilleSide*r*.18,r*.10,r*(1.18+mt*.34),
        Math.PI*(.20+mt*.34),Math.PI*(1.02+mt*.74),p.marseilleSide<0);
      ctx.stroke();
      ctx.restore();
    }

    const sprite=unitSprites[currentRound]?.[p.team];
    if(sprite && sprite.complete && sprite.naturalWidth){
      const size=r*2.65;
      ctx.save();
      ctx.rotate(p.visualAngle+marseilleVisualSpin);
      ctx.shadowColor=p.team==="A" ? "rgba(255,77,77,.45)" :
        p.team==="B" ? "rgba(77,141,255,.45)" :
        p.team==="C" ? "rgba(255,216,77,.45)" : p.team==="D" ? "rgba(57,212,106,.45)" : "rgba(255,255,255,.35)";
      ctx.shadowBlur=Math.max(2,r*.18);
      ctx.drawImage(sprite,-size/2,-size/2,size,size);
      ctx.restore();
    }else{
      // Sprite-load fallback stays team-colored; collision never changes the icon.
      ctx.fillStyle=teamColor(p.team);
      ctx.strokeStyle="#07111a";
      ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    }

    ctx.fillStyle="#07111a";
    ctx.font=`900 ${Math.max(12,r*.85)}px system-ui`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(String(rank),0,1);

    // Nickname directly over the icon.
    ctx.font=`800 ${Math.max(10,r*.82)}px system-ui`;
    const label=p.name;
    const tw=ctx.measureText(label).width+14;
    const lh=Math.max(15,r*1.02);
    const ly=-r*1.48;
    ctx.fillStyle="rgba(5,8,13,.88)";
    ctx.strokeStyle=teamColor(p.team);ctx.lineWidth=1.5;
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(-tw/2,ly-lh,tw,lh,5);
    else ctx.rect(-tw/2,ly-lh,tw,lh);
    ctx.fill();ctx.stroke();
    ctx.fillStyle="#fff";ctx.textBaseline="bottom";
    ctx.fillText(label,0,ly-2);

    ctx.restore();
  }

  const renderOrder=[];

  const MINI_CROP={x:24,y:8,w:134,h:150};
  let lastMiniMapRender=0;
  function renderMiniMap(){
    const now=performance.now();
    const miniInterval=fpsProtectLevel>=2?200:125;
    if(now-lastMiniMapRender<miniInterval)return;
    lastMiniMapRender=now;
    const mc=document.getElementById("miniMap");
    if(!mc||!map.complete)return;
    const mx=mc.getContext("2d"),W=mc.width,H=mc.height;
    mx.clearRect(0,0,W,H);
    mx.globalAlpha=.78;
    mx.drawImage(map,MINI_CROP.x*MAP_IMAGE_SCALE_X,MINI_CROP.y*MAP_IMAGE_SCALE_Y,MINI_CROP.w*MAP_IMAGE_SCALE_X,MINI_CROP.h*MAP_IMAGE_SCALE_Y,0,0,W,H);
    mx.globalAlpha=1;
    const sx=W/MINI_CROP.w,sy=H/MINI_CROP.h;
    for(let i=0;i<players.length;i++){
      const p=players[i];
      if(p.dead) continue;
      const x=(p.x-MINI_CROP.x)*sx,y=(p.y-MINI_CROP.y)*sy;
      if(x<0||y<0||x>W||y>H) continue;
      mx.beginPath();mx.arc(x,y,2.45,0,Math.PI*2);
      mx.fillStyle=p.color;mx.fill();
      mx.lineWidth=.75;mx.strokeStyle="rgba(0,0,0,.92)";mx.stroke();
    }
  }

  function drawAIPOVOverlay(view){
    if(povPlayerIndex<0) return;
    const p=players[povPlayerIndex]; if(!p) return;
    const now=gameNow();
    const sx=x=>(x-view.sx)*view.scale, sy=y=>(y-view.sy)*view.scale;
    ctx.save();
    // Genuine held virtual-mouse target.
    const tx=sx(p.mouseTargetX), ty=sy(p.mouseTargetY);
    ctx.setLineDash([8,7]); ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.88)';
    ctx.beginPath(); ctx.moveTo(sx(p.x),sy(p.y)); ctx.lineTo(tx,ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(tx,ty,8,0,Math.PI*2); ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx-12,ty);ctx.lineTo(tx+12,ty);ctx.moveTo(tx,ty-12);ctx.lineTo(tx,ty+12);ctx.stroke();
    // Actual click log: recent commands only, never reconstructed from movement.
    const logs=Array.isArray(p.mouseClickLog)?p.mouseClickLog:[];
    for(let i=Math.max(0,logs.length-10);i<logs.length;i++){
      const c=logs[i], age=now-c.t; if(age>2600) continue;
      const a=Math.max(.18,1-age/2600), cx=sx(c.x),cy=sy(c.y);
      ctx.globalAlpha=a; ctx.beginPath();ctx.arc(cx,cy,4.5,0,Math.PI*2);ctx.fillStyle='#ffe36e';ctx.fill();
    }
    ctx.globalAlpha=1;
    // Only observers present in this player's perception memory are highlighted.
    if(p.perceivedObservers){
      for(const m of p.perceivedObservers.values()){
        const age=now-m.lastSeen; if(age>900 || now<(m.awareAt||0)) continue;
        const cx=sx(m.x),cy=sy(m.y); ctx.beginPath();ctx.arc(cx,cy,12,0,Math.PI*2);
        ctx.strokeStyle=(m.id===p.liveEvadeThreat)?'#ff6969':'#69e7ff';ctx.lineWidth=(m.id===p.liveEvadeThreat)?4:2;ctx.stroke();
      }
    }
    ctx.globalAlpha=1;
    const state=p.reactionDangerActive && now<(p.mouseReactionReadyAt||0)?'반응 대기':(p.mouseMode||'race');
    const lines=[`${p.name} AI POV`, `행동 ${state} · 클릭 #${p.mouseClickSeq||0}`, `위협 OBS ${p.liveEvadeThreat>=0?p.liveEvadeThreat:'--'} · 반응 ${Math.round(p.lastReactionDelayMs||0)}ms`, `흰 십자=현재 실제 클릭 · 노란점=최근 실제 클릭 · 청록원=인지 OBS`];
    ctx.font='600 18px system-ui,sans-serif'; const boxW=520,boxH=100;
    ctx.fillStyle='rgba(5,10,18,.76)';ctx.fillRect(18,18,boxW,boxH);
    lines.forEach((t,i)=>{ctx.fillStyle=i===0?'#fff':'#d9e7f5';ctx.fillText(t,32,43+i*21);});
    ctx.restore();
  }

  function render(ts){
    const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H);
    if(!map.complete) return;

    const view=getView();
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality="high";
    ctx.drawImage(map,view.sx*MAP_IMAGE_SCALE_X,view.sy*MAP_IMAGE_SCALE_Y,view.viewW*MAP_IMAGE_SCALE_X,view.viewH*MAP_IMAGE_SCALE_Y,0,0,W,H);

    // v2.07: cull + batch all visible observers into a few canvas paths.
    // This sharply reduces per-observer draw calls while preserving their look.
    const visibleObs=drawObservers(view);

    renderOrder.length=0;
    for(let i=0;i<players.length;i++) renderOrder.push(players[i]);
    renderOrder.sort((a,b)=>currentProgress(b)-currentProgress(a));
    for(let i=0;i<renderOrder.length;i++){
      const rp=renderOrder[i];
      if(!rp.dead || gameNow()<rp.hitFxUntil) drawPlayer(rp,view,i+1);
    }
    drawAIPOVOverlay(view);

    const elapsed=raceStart ? Math.max(0,(simClock||ts||performance.now())-raceStart) : 0;
    clockEl.textContent=formatTime(elapsed);
    lastVisibleObs=visibleObs;
    renderMiniMap();
  }

  const RECORD_KEY="observerFM_v27_records";

  function blankRecordBook(){
    const playersRec={}; for(const n of names) playersRec[n]=null;
    return {map:null,mapName:"",players:playersRec};
  }
  function loadRecordBook(){
    try{
      const raw=JSON.parse(localStorage.getItem(RECORD_KEY)||"null")||blankRecordBook();
      const base=blankRecordBook();
      base.map=Number.isFinite(raw.map)?raw.map:null;
      base.mapName=raw.mapName||"";
      for(const n of names){
        const v=raw.players&&raw.players[n];
        base.players[n]=Number.isFinite(v)?v:null;
      }
      return base;
    }catch(e){ return blankRecordBook(); }
  }
  function saveRecordBook(book){try{localStorage.setItem(RECORD_KEY,JSON.stringify(book));}catch(e){}}
  function registerFinishRecord(p,timeMs){
    const book=loadRecordBook();
    const oldPB=book.players[p.name];
    p.newPB=oldPB==null || timeMs<oldPB;
    if(p.newPB) book.players[p.name]=timeMs;
    p.newMapRecord=book.map==null || timeMs<book.map;
    if(p.newMapRecord){book.map=timeMs;book.mapName=p.name;}
    saveRecordBook(book);
    renderRecordBoard();
  }
  function renderRecordBoard(){
    const el=document.getElementById("recordBoard"); if(!el)return;
    const book=loadRecordBook();
    const leader=[...players].sort((a,b)=>currentProgress(b)-currentProgress(a))[0];
    const leaderPB=leader?book.players[leader.name]:null;
    el.innerHTML=`<div><span>맵 최고기록</span><b>${book.map==null?"--":formatTime(book.map)}</b><small>${book.mapName||""}</small></div>
      <div><span>선두 PB</span><b>${leaderPB==null?"--":formatTime(leaderPB)}</b><small>${leader?leader.name:""}</small></div>`;
  }

  let prevRanks=new Map();
  const SEASON_KEY="observerFM_v31_season";
  let seasonRecorded=false;

  function blankSeasonRow(){
    return {starts:0,wins:0,top3:0,finishes:0,totalRank:0,totalTime:0,bestTime:null,
      collisions:0,stops:0,avoids:0,overtakes:0,leadMs:0,distance:0,nearMisses:0,extremeNearMisses:0,dangerExposureMs:0,totalRating:0,cleanRaces:0};
  }

  function loadSeason(){
    try{
      const data=JSON.parse(localStorage.getItem(SEASON_KEY)||"{}");
      for(const n of names){if(!data[n])data[n]=blankSeasonRow();else data[n]=Object.assign(blankSeasonRow(),data[n]);}
      return data;
    }catch(e){
      const data={}; for(const n of names) data[n]=blankSeasonRow(); return data;
    }
  }

  function saveSeason(data){
    try{ localStorage.setItem(SEASON_KEY,JSON.stringify(data)); }catch(e){}
  }

  function recordSeasonResults(){if(seasonRecorded||roundHistory.length<5)return;const season=loadSeason();for(const round of roundHistory)for(const x of round.players){const s=season[x.name]||blankSeasonRow();s.starts++;s.totalRank+=x.rank;s.finishes++;if(x.rank===1)s.wins++;if(x.rank<=3)s.top3++;s.totalTime+=x.time||0;s.bestTime=s.bestTime==null?x.time:Math.min(s.bestTime,x.time);s.collisions+=x.collisions||0;if(!x.collisions)s.cleanRaces++;s.avoids+=x.avoids||0;s.overtakes+=x.overtakes||0;s.leadMs+=x.leadMs||0;s.distance+=x.distance||0;s.nearMisses+=x.nearMisses||0;s.extremeNearMisses+=x.extremeNearMisses||0;s.dangerExposureMs+=x.dangerExposureMs||0;s.totalRating+=x.rating||0;season[x.name]=s;}saveSeason(season);seasonRecorded=true;renderEloRanking();}

  function eloMetrics(s){const n=Math.max(1,s.starts||0),avgRank=(s.totalRank||0)/n,rankPower=(12-avgRank)/11,winRate=(s.wins||0)/n,top3Rate=(s.top3||0)/n,avgRating=(s.totalRating||0)/n,avoid=(s.avoids||0)/Math.max(1,(s.avoids||0)+(s.collisions||0)),nm=Math.min(1,(s.nearMisses||0)/(n*12)),ov=Math.min(1,(s.overtakes||0)/(n*4)),clean=(s.cleanRaces||0)/n,lead=Math.min(1,(s.leadMs||0)/(n*18000));const power=rankPower*.55+(winRate*.55+top3Rate*.45)*.14+Math.max(0,Math.min(1,(avgRating-4)/6))*.09+(avoid*.68+nm*.32)*.09+ov*.05+clean*.05+lead*.03;return{avgRank,winRate,top3Rate,avgRating,avoid,elo:Math.round(1000+power*1000)}}
  function renderEloRanking(){const box=document.getElementById("eloRankingList");if(!box)return;const s=loadSeason(),rows=names.map(name=>({name,s:s[name],m:eloMetrics(s[name])})).sort((a,b)=>b.m.elo-a.m.elo||a.m.avgRank-b.m.avgRank);box.innerHTML=rows.map((r,i)=>`<div class="elo-row"><div class="elo-rank">${i+1}</div><div class="elo-name"><b>${r.name}</b><small>${styleLabel(drivingStyles[names.indexOf(r.name)].style)}</small></div><div class="elo-score">${r.m.elo}</div><div class="elo-data">평균 ${r.s.starts?r.m.avgRank.toFixed(2):"--"}위 · ${r.s.starts}경기 · 승률 ${(r.m.winRate*100).toFixed(1)}% · 상위3 ${(r.m.top3Rate*100).toFixed(1)}%<br>평점 ${r.s.starts?r.m.avgRating.toFixed(2):"--"} · 회피율 ${(r.m.avoid*100).toFixed(1)}% · 아슬회피 ${r.s.nearMisses||0} · 충돌 ${r.s.collisions||0} · 추월 ${r.s.overtakes||0}</div></div>`).join("")}

  function resetSeason(){
    if(!confirm("시즌 누적 기록을 전부 초기화할까요?")) return;
    localStorage.removeItem(SEASON_KEY);
    alert("시즌 기록을 초기화했습니다.");
  }

  function estimatedFinishSeconds(p,now=gameNow()){
    if(!raceStart || p.done) return p.finishTime ? p.finishTime/1000 : null;
    const prog=Math.max(1,currentProgress(p));
    const elapsed=Math.max(.1,(now-raceStart)/1000);
    const rate=prog/elapsed;
    return rate>0 ? elapsed+(routeLength-prog)/rate : null;
  }

  function chooseBroadcastBattle(){
    const ranks=players.filter(p=>!p.done)
      .map(p=>({p,prog:currentProgress(p)}))
      .sort((a,b)=>b.prog-a.prog);
    if(ranks.length<2) return null;

    let best=null,bestScore=-999;
    for(let i=0;i<ranks.length-1;i++){
      const a=ranks[i], b=ranks[i+1];
      const gap=a.prog-b.prog;
      if(gap>2.15) continue;
      const closeScore=Math.max(0,2.15-gap)*2.0;
      const rankScore=i===0?2.5:i<3?1.2:.35;
      const finishScore=a.prog>routeLength*.90?4.0:0;
      const recentAttack=Math.min(1.5,((a.p.match.overtakes||0)+(b.p.match.overtakes||0))*.10);
      const score=closeScore+rankScore+finishScore+recentAttack;
      if(score>bestScore){
        bestScore=score;
        best={a:a.p,b:b.p,label:i===0?(a.prog>routeLength*.90?"FINISH BATTLE":"LEAD BATTLE"):"CLOSE BATTLE"};
      }
    }
    if(!best && ranks[0].prog>routeLength*.93){
      return {a:ranks[0].p,b:ranks[1].p,label:"FINISH BATTLE"};
    }
    return best;
  }

  function highlightTypeLabel(type){
    const labels={
      PHOTO_FINISH:"초접전 결승",MULTIPASS:"연속 추월",OVERTAKE:"추월",
      LEAD_CHANGE:"선두 변경",COMEBACK:"대역전",BACKCON:"빽컨 회피",
      STOPCON:"스탑컨 회피",FINISH:"완주",WIN:"우승",CLEAN:"무충돌",
      BEST_SECTOR:"최고 구간기록",
      FOLLOWER_SAVE:"연쇄 생존 회피",
      MARSEILLE:"마르세유턴"
    };
    return labels[type]||String(type||"").replaceAll("_"," ");
  }

  function addAutoHighlight(type,text,now=gameNow(),playerId=-1,importance=1){
    if(!raceStart) return;
    const t=Math.max(0,now-raceStart);
    const last=highlightMarkers[highlightMarkers.length-1];
    if(last && last.type===type && last.playerId===playerId && t-last.t<1200) return;
    highlightMarkers.push({type,text,t,playerId,importance});
    if(highlightMarkers.length>40) highlightMarkers.shift();
  }

  function pushRaceEvent(text,now=gameNow()){
    raceEventText=text;raceEventUntil=now+1600;
    const spoken=text.replace("OVERTAKE · ","추월! ").replace("NEW LEADER · ","새로운 선두! ").replace(/최고 구간기록 (\d+) · /,"최고 구간기록! ").replace("FINISH · ","결승선 통과! ");
    // v2.43: LIVE commentary removed; highlights/events are still recorded.
  }

  function updateSectors(now){
    if(!raceStart) return;
    for(let i=0;i<players.length;i++){
      const p=players[i];
      if(p.done || p.sectorIndex>=SECTOR_MARKS.length) continue;
      const frac=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
      while(p.sectorIndex<SECTOR_MARKS.length && frac>=SECTOR_MARKS[p.sectorIndex]){
        const elapsed=now-raceStart;
        const sectorMs=elapsed-p.sectorStartMs;
        p.sectorTimes[p.sectorIndex]=sectorMs;
        const si=p.sectorIndex;
        p.sectorStartMs=elapsed;
        p.sectorIndex++;
        if(!bestSector[si] || sectorMs<bestSector[si].time){
          bestSector[si]={name:p.name,time:sectorMs};
          pushRaceEvent(`최고 구간기록 ${si+1} · ${p.name} ${formatTime(sectorMs)}`,now);
        }
      }
    }
  }

  function updateMatchRanks(dt,now=gameNow()){
    const ordered=[...players].sort((a,b)=>currentProgress(b)-currentProgress(a));
    ordered.forEach((p,idx)=>{
      const rank=idx+1;
      p.match.bestRank=Math.min(p.match.bestRank,rank);
      p.match.worstRank=Math.max(p.match.worstRank,rank);
      p.match.maxRankGain=Math.max(p.match.maxRankGain,p.match.startRank-rank);
      p.match.maxRankLoss=Math.max(p.match.maxRankLoss,rank-p.match.startRank);
      const prev=prevRanks.get(p.index);
      if(prev!=null && rank<prev){
        const gained=prev-rank;
        p.match.overtakes += gained;
        if(gained>=1){
          pushRaceEvent(`OVERTAKE · ${p.name} ${prev}위 → ${rank}위`,now);
          raceTotalOvertakes+=gained;
          addAutoHighlight(gained>=2?"MULTIPASS":"OVERTAKE",
            `${p.name} · ${prev}위 → ${rank}위${gained>=2?" 연속 추월":""}`,
            now,p.index,gained>=2?2:1);
          // v2.06: overtake events are shown in the HUD only; camera remains leader-focused.
        }
      }
      prevRanks.set(p.index,rank);
    });
    if(ordered[0] && !ordered[0].done){
      ordered[0].match.leadMs += dt;
      if(lastLeaderName && lastLeaderName!==ordered[0].name){
        raceLeaderChanges++;
        const oldLeader=lastLeaderName;
        pushRaceEvent(`NEW LEADER · ${ordered[0].name}`,now);

        addAutoHighlight("LEAD_CHANGE",`NEW LEADER · ${ordered[0].name}`,now,ordered[0].index,2);
      }
      lastLeaderName=ordered[0].name;
    }
  }


  let lastLiveStatsRender=0;
  function playerDangerStatus(p){const raw=playerNearbyObservers(p,13),s=segs[Math.min(p.seg,segs.length-1)];let front=0,close=0;for(const o of raw){const dx=o.x-p.x,dy=o.y-p.y;if(dx*dx+dy*dy<49)close++;if(dx*s.ux+dy*s.uy>0&&Math.abs(dx*s.nx+dy*s.ny)<4.2)front++;}const score=close+front*1.6;return score>=9?"극위험":score>=5?"위험":score>=2?"주의":"안전";}

  function livePerformanceRating(p,ordered,now=gameNow()){
    const rank=Math.max(1,ordered.indexOf(p)+1);
    const progress=Math.max(0,Math.min(1,currentProgress(p)/routeLength));
    const m=p.match||{};
    const avoidAttempts=Math.max(1,(m.avoids||0)+(m.collisions||0));
    const avoidRate=(m.avoids||0)/avoidAttempts;
    const controlRate=(m.controlAttempts||0)>0 ? (m.controlSuccesses||0)/(m.controlAttempts||1) : .72;
    const rankScore=(12-rank)/11;
    const passScore=Math.min(1,(m.overtakes||0)/5);
    const collisionPenalty=Math.min(1,(m.collisions||0)/3);
    const leadScore=Math.min(1,(m.leadMs||0)/Math.max(1000,(now-raceStart)));
    const gainScore=Math.max(0,Math.min(1,(m.maxRankGain||0)/5));

    // Integrated live performance: survival/avoidance has the largest weight.
    // Current rank matters, but cannot by itself create an elite rating.
    const composite=
      avoidRate*.30 +
      rankScore*.20 +
      controlRate*.14 +
      passScore*.11 +
      leadScore*.08 +
      gainScore*.07 +
      progress*.10 -
      collisionPenalty*.18;
    return Math.max(4.0,Math.min(10.0,5.15+composite*4.85));
  }

  function renderLiveRatings(now=gameNow()){
    const box=document.getElementById("liveRatingList");
    if(!box)return;
    const ordered=liveOrderedPlayers();
    if(!ordered.length){box.innerHTML="";return;}
    box.innerHTML=ordered.map(p=>{
      const rating=livePerformanceRating(p,ordered,now);
      if(now-(p.lastRatingSampleAt||0)>=900){
        p.lastRatingSampleAt=now;p.liveRatingHistory.push(rating);
        if(p.liveRatingHistory.length>24)p.liveRatingHistory.shift();
      }
      const h=p.liveRatingHistory.length?p.liveRatingHistory:[rating];
      const pts=h.map((v,i)=>`${(h.length===1?117:i*117/(h.length-1)).toFixed(1)},${(20-Math.max(0,Math.min(1,(v-4)/6))*18).toFixed(1)}`).join(" ");
      const last=h[h.length-1];
      const endX=(h.length===1?117:117).toFixed(1);
      const endY=(20-Math.max(0,Math.min(1,(last-4)/6))*18).toFixed(1);
      return `<div class="live-rating-row" style="--player-color:${p.color}">
        <span class="live-rating-name"><i class="rating-dot"></i>${p.name}</span>
        <svg class="rating-spark" viewBox="0 0 118 22" aria-label="${p.name} 실시간 평점 추이">
          <line class="rating-baseline" x1="0" y1="20" x2="118" y2="20"/>
          <polyline points="${pts}" style="stroke:${p.color}"/>
          <circle cx="${endX}" cy="${endY}" r="1.8" style="fill:${p.color}"/>
        </svg>
        <strong class="live-rating-value" style="color:${p.color}">${rating.toFixed(1)}</strong>
      </div>`;
    }).join("");
  }

  function renderLiveStats(now=gameNow()){
    if(now-lastLiveStatsRender<950)return;
    lastLiveStatsRender=now;
    renderLiveRatings(now);
    const summary=document.getElementById("liveStatsSummary");
    const leaders=document.getElementById("liveStatsLeaders");
    const raceBox=document.getElementById("liveStatsRace");
    const playerBox=document.getElementById("liveStatsPlayers");
    const phase=document.getElementById("liveStatsPhase");
    if(!summary||!leaders||!raceBox||!playerBox)return;
    const ordered=liveOrderedPlayers();if(!ordered.length)return;
    const collisions=players.reduce((s,p)=>s+(p.match?.collisions||0),0);
    const overtakes=players.reduce((s,p)=>s+(p.match?.overtakes||0),0);
    const avoids=players.reduce((s,p)=>s+(p.match?.avoids||0),0);
    const controls=players.reduce((s,p)=>s+(p.match?.controlAttempts||0),0);
    const stops=players.reduce((s,p)=>s+(p.match?.stops||0),0);const nearMisses=players.reduce((s,p)=>s+(p.match?.nearMisses||0),0);
    const p1=ordered[0],p2=ordered[1];
    const gap=broadcastGapSeconds(p1,p2);
    const eta=estimatedFinishSeconds(p1,now);
    const bestPass=[...players].sort((a,b)=>(b.match?.overtakes||0)-(a.match?.overtakes||0))[0];
    const bestAvoid=[...players].sort((a,b)=>(b.match?.avoids||0)-(a.match?.avoids||0))[0];
    const bestLead=[...players].sort((a,b)=>(b.match?.leadMs||0)-(a.match?.leadMs||0))[0];
    const bestGain=[...players].sort((a,b)=>(b.match?.maxRankGain||0)-(a.match?.maxRankGain||0))[0];
    const prog=Math.max(0,Math.min(1,currentProgress(p1)/routeLength));
    if(phase)phase.textContent=`${currentRound}R · ${Math.round(prog*100)}%`;

    summary.innerHTML=`<div><span>충돌</span><b>${collisions}</b></div><div><span>추월</span><b>${overtakes}</b></div><div><span>회피</span><b>${avoids}</b></div><div><span>컨트롤</span><b>${controls}</b></div><div><span>스탑</span><b>${stops}</b></div><div><span>선두교체</span><b>${raceLeaderChanges}</b></div><div><span>NEAR MISS</span><b>${nearMisses}</b></div>`;

    const row=(label,p,val)=>`<div class="live-stat-leader"><span>${label}</span>${avatarHtml(p.index,"live-stat-avatar")}<b>${p.name}</b><strong>${val}</strong></div>`;
    leaders.innerHTML=row("추월",bestPass,bestPass.match?.overtakes||0)+
      row("회피",bestAvoid,bestAvoid.match?.avoids||0)+
      row("선두",bestLead,`${((bestLead.match?.leadMs||0)/1000).toFixed(1)}초`)+
      row("상승",bestGain,`+${bestGain.match?.maxRankGain||0}`);

    const dangerBox=document.getElementById("liveDanger");if(dangerBox)dangerBox.innerHTML=`<span>선두 주변 위험도</span><b>${playerDangerStatus(p1)}</b>`;
    raceBox.innerHTML=`<div><span>현재 선두</span><b>${p1.name}</b></div>
      <div><span>1↔2 격차</span><b>${gap==null?"--":gap.toFixed(2)+"초"}</b></div>
      <div><span>선두 예상기록</span><b>${eta==null?"--":eta.toFixed(2)+"초"}</b></div>
      <div><span>밀집구역</span><b>${observerDensityZones.length}곳</b></div>`;

    playerBox.innerHTML=ordered.slice(0,5).map((p,i)=>{
      const line=p.linePersonality>.45?"인코스":p.linePersonality<-.45?"안전/외곽":"균형";
      const creative=Math.min(55,Math.round((p.creativeRouteUsed||0)*100));
      return `<div class="live-player-stat"><span>${i+1}</span>${avatarHtml(p.index,"live-stat-avatar")}<b>${p.name}</b><small>${line}</small><em>스타트 ${(p.startReactionMs/1000).toFixed(3)}초 · 압박 ${Math.round((p.livePressure||0)*100)}% · 아슬회피 ${p.match?.nearMisses||0} · 충돌 ${p.match?.collisions||0}</em></div>`;
    }).join("");
  }

  const rankRowCache=new Map();

  function rankRowFor(index){
    let c=rankRowCache.get(index);
    if(c) return c;
    const row=document.createElement("div");
    row.className="rank-row";
    row.innerHTML=`<span class="rank-no"></span><span class="rank-trend"></span>
      <span class="team-mini"></span><button class="rank-name player-link"></button>
      <span class="rank-gap"></span>`;
    const no=row.querySelector(".rank-no");
    const trend=row.querySelector(".rank-trend");
    const team=row.querySelector(".team-mini");
    const name=row.querySelector(".rank-name");
    const gap=row.querySelector(".rank-gap");
    name.dataset.player=String(index);
    name.addEventListener("click",()=>{
      const idx=Number(name.dataset.player);
      if(players[idx]) openPlayerCard(players[idx]);
    });
    c={row,no,trend,team,name,gap};
    rankRowCache.set(index,c);
    return c;
  }

  function rankingTimeClass(ms){
    const sec=Math.max(0,ms/1000);
    if(sec<40) return "time-u40";
    if(sec<50) return "time-40";
    if(sec<60) return "time-50";
    if(sec<70) return "time-60";
    if(sec<80) return "time-70";
    if(sec<90) return "time-80";
    return "time-90";
  }

  function renderRanking(){
    const ordered=[...players].sort((a,b)=>{
      if(a.done && b.done) return a.finishTime-b.finishTime;
      if(a.done) return -1;if(b.done) return 1;
      if(a.dead!==b.dead) return a.dead?1:-1;
      const diff=currentProgress(b)-currentProgress(a);
      if(Math.abs(diff)<0.20) return a.index-b.index;
      return diff;
    });
    if(!ordered.length) return;
    const frag=document.createDocumentFragment();
    const leaderProg=currentProgress(ordered[0]);

    for(let i=0;i<ordered.length;i++){
      const p=ordered[i], c=rankRowFor(p.index);
      let gapText;
      if(p.done) gapText=formatTime(p.finishTime);
      else if(p.dead) gapText="사망";
      else if(i===0) gapText="선두";
      else{
        const distGap=Math.max(0,leaderProg-currentProgress(p));
        gapText=`+${(distGap/Math.max(1,ordered[0].speed||1)).toFixed(2)}초`;
      }
      const rank=i+1, oldRank=previousUiRanks.get(p.index);
      const trendText=oldRank==null?"":rank<oldRank?"▲":rank>oldRank?"▼":"";
      previousUiRanks.set(p.index,rank);
      const eta=(i===0&&!p.done)?estimatedFinishSeconds(p):null;
      const etaText=eta?` · 예상 ${eta.toFixed(2)}초`:"";

      c.no.textContent=String(rank);
      c.trend.textContent=trendText;
      c.team.textContent=p.team;
      c.team.className=`team-mini team-${p.team.toLowerCase()}`;
      c.name.textContent=p.name;
      c.gap.textContent=gapText+etaText;
      const displayMs=p.done ? p.finishTime : (raceStart?Math.max(0,(gameNow()-raceStart)):0);
      c.gap.className=`rank-gap ${rankingTimeClass(displayMs)}`;
      frag.appendChild(c.row);
    }
    // Existing nodes are simply reordered; listeners/DOM nodes are reused.
    rankingEl.appendChild(frag);
    renderRecordBoard();
    renderLiveRatings();
  }

  function statLabel(k){
    const labels={pace:"속도",acceleration:"가속",cornering:"코너링",insideLine:"인코스",routeReading:"루트판단",
      avoidance:"회피",reaction:"반응속도",prediction:"예측",control:"컨트롤",stability:"안정성",braking:"브레이킹",
      recovery:"회복",consistency:"일관성",focus:"집중력",aggression:"공격성",riskControl:"리스크관리",
      pressure:"압박대응",start:"스타트",endurance:"지구력",luck:"운"};
    return labels[k]||k;
  }

  function styleLabel(style){
    const labels={apexHunter:"인코스 공격형",safeReader:"안전 예측형",attacker:"공격형",lineMaster:"최단라인형",
      balanced:"밸런스형",controller:"컨트롤형",patient:"신중형",opportunist:"기회포착형"};
    return labels[style]||style;
  }


  const avatarCache=new Map();
  const avatarHair=["#dfe9ff","#161b2b","#8b2530","#d7a15b","#24415f","#e56c42","#593866","#2c3146"];
  const avatarSkin=["#f0c7a6","#d8a47f","#edc2a4","#c98f6b","#e4b38e","#bc8566","#efc7a8","#d69c78"];

  function playerAvatar(index){
    if(avatarCache.has(index)) return avatarCache.get(index);
    const name=names[index]||"?";
    const hair=avatarHair[index%avatarHair.length], skin=avatarSkin[index%avatarSkin.length];
    const accent=colors[index%colors.length];
    const initials=name.slice(0,2).toUpperCase();
    const fringe=index%4;
    const hairPath=[
      "M18 33 Q25 5 52 10 Q78 8 83 35 Q72 24 60 27 Q46 13 18 33Z",
      "M15 34 Q18 7 50 9 Q80 10 84 36 Q70 20 58 24 L52 12 L45 28 Q30 20 15 34Z",
      "M16 33 Q26 4 55 9 Q76 10 84 35 Q67 24 57 30 Q50 16 43 31 Q28 23 16 33Z",
      "M17 35 Q22 8 51 8 Q78 8 84 35 L66 25 L58 13 L49 30 L38 17 L30 31Z"
    ][fringe];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#09111c"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
      <rect width="96" height="96" rx="18" fill="url(#g)"/>
      <circle cx="48" cy="42" r="25" fill="${skin}"/>
      <path d="${hairPath}" fill="${hair}"/>
      <path d="M27 45 Q35 40 41 44" fill="none" stroke="#18202c" stroke-width="2" stroke-linecap="round"/>
      <path d="M55 44 Q62 40 69 45" fill="none" stroke="#18202c" stroke-width="2" stroke-linecap="round"/>
      <circle cx="36" cy="47" r="2.6" fill="#15202d"/><circle cx="61" cy="47" r="2.6" fill="#15202d"/>
      <path d="M42 58 Q48 62 55 58" fill="none" stroke="#8c5148" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 96 Q23 70 48 70 Q73 70 78 96Z" fill="${accent}" opacity=".88"/>
      <circle cx="48" cy="48" r="43" fill="none" stroke="${accent}" stroke-width="3" opacity=".55"/>
      <text x="48" y="89" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="800" fill="white">${initials}</text>
    </svg>`;
    const uri="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    avatarCache.set(index,uri);
    return uri;
  }

  function avatarHtml(index,cls="player-avatar"){
    const name=names[index]||"선수";
    return `<img class="${cls}" src="${playerAvatar(index)}" alt="${name} 캐릭터">`;
  }

  function overallOf(p){
    const vals=Object.values(p.stats);
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  }

  function seasonCardHtml(p){
    const s=loadSeason()[p.name]||blankSeasonRow();
    const pb=loadRecordBook().players[p.name];
    if(!s.starts) return `<div class="seasonBox"><h3>시즌 기록</h3><p>개인 최고기록 ${pb==null?"-":formatTime(pb)}</p></div>`;
    const avgRank=s.totalRank/s.starts;
    const finishRate=s.finishes/s.starts*100;
    const avgTime=s.finishes ? s.totalTime/s.finishes : 0;
    const avgCollision=s.collisions/s.starts;
    return `<div class="seasonBox">
      <h3>시즌 누적 기록</h3>
      <div class="seasonGrid">
        <div><span>출전</span><b>${s.starts}</b></div>
        <div><span>우승</span><b>${s.wins}</b></div>
        <div><span>상위 3위</span><b>${s.top3}</b></div>
        <div><span>평균 순위</span><b>${avgRank.toFixed(2)}</b></div>
        <div><span>완주율</span><b>${finishRate.toFixed(1)}%</b></div>
        <div><span>평균 기록</span><b>${formatTime(avgTime)}</b></div>
        <div><span>개인 최고기록</span><b>${pb==null?"-":formatTime(pb)}</b></div>
        <div><span>경기당 충돌</span><b>${avgCollision.toFixed(2)}</b></div>
        <div><span>총 추월</span><b>${s.overtakes}</b></div>
        <div><span>선두 시간</span><b>${(s.leadMs/1000).toFixed(1)}s</b></div>
      </div>
    </div>`;
  }

  function identitySummary(p){
    const s=p.drivingStyle.style;
    if(s==="apexHunter") return "극인코스/공격적 코너 공략";
    if(s==="safeReader") return "안전거리/옵저버 예측 우선";
    if(s==="attacker") return "빠른 추월판단/빽컨 선호";
    if(s==="lineMaster") return "레이싱라인/코너 정밀도 우선";
    if(s==="controller") return "컨트롤 대응/지그재그 회피 선호";
    if(s==="patient") return "기다렸다 추월/외곽 안전라인";
    if(s==="opportunist") return "빈틈 포착/순간 추월 공략";
    return "균형형 주행/상황 대응";
  }

  function openPlayerCard(p){
    const modal=document.getElementById("playerModal");
    const title=document.getElementById("playerModalTitle");
    const body=document.getElementById("playerModalBody");
    const entries=Object.entries(p.stats).sort((a,b)=>b[1]-a[1]);
    title.textContent=`${p.name} · OVR ${overallOf(p)} · ${styleLabel(p.drivingStyle.style)}`;
    body.innerHTML=`
      <div class="profile-hero">
        ${avatarHtml(p.index,"profile-avatar")}
        <div><b>${p.name}</b><span>${teamLabel(p.team)} · ${styleLabel(p.drivingStyle.style)}</span><small>OVR ${overallOf(p)}</small></div>
      </div>
      <div class="profileSummary">
        <div><b>소속팀</b><span>${teamLabel(p.team)}</span></div>
        <div><b>주행 성향</b><span>${styleLabel(p.drivingStyle.style)}</span></div>
        <div><b>AI 개성</b><span>${identitySummary(p)}</span></div>
        <div><b>당일 컨디션</b><span>${p.raceForm>=1.025?"좋음":p.raceForm<=.975?"흔들림":"보통"}</span></div>
        <div><b>팀전 누적점수</b><span>${playerTournament[p.index]?.total||0}점</span></div>
        <div><b>강점</b><span>${entries.slice(0,3).map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
        <div><b>약점</b><span>${entries.slice(-3).reverse().map(([k,v])=>`${statLabel(k)} ${v}`).join(" · ")}</span></div>
      </div>
      <div class="statGrid">${Object.entries(p.stats).map(([k,v])=>`<div class="statCell"><span>${statLabel(k)}</span><b>${v}</b></div>`).join("")}</div>
      ${seasonCardHtml(p)}`;
    modal.classList.remove("hidden");
  }


  // v2.23: FM-style single-match rating.
  // Rating rewards actual race contribution, not raw attributes.
  function roundPerformanceRating(x){
    let score=6.00;

    // Finish position is important, but not the whole rating.
    score += (9-x.rank)*.19;

    // Race contribution.
    score += Math.min(1.05,(x.overtakes||0)*.11);
    score += Math.min(.70,(x.leadMs||0)/1000*.018);
    score += Math.min(.45,(x.avoids||0)*.025);
    score += Math.min(.42,Math.max(0,x.rankGain||0)*.09);

    // Execution quality.
    const controlRate=x.controlAttempts ? x.controlSuccesses/x.controlAttempts : 1;
    score += (controlRate-.75)*.90;
    score += Math.max(-.18,Math.min(.22,((x.efficiency||100)-100)*.035));

    // Mistakes are costly.
    score -= (x.collisions||0)*.42;

    // Small condition interpretation only; it does not directly hand out a big bonus.
    if(x.raceForm!=null) score += Math.max(-.10,Math.min(.10,(x.raceForm-1)*2.2));

    return Math.max(4.0,Math.min(10.0,score));
  }

  function aggregateMatchRatings(){
    const rows=players.map(p=>({
      index:p.index,name:p.name,team:p.team,
      ratingSum:0,rounds:0,best:0,worst:10,
      wins:0,top3:0,overtakes:0,collisions:0,rankGain:0
    }));
    for(const round of roundHistory){
      for(const x of round.players){
        const a=rows[x.index];
        const rt=roundPerformanceRating(x);
        x.rating=rt;
        a.ratingSum+=rt;a.rounds++;
        a.best=Math.max(a.best,rt);a.worst=Math.min(a.worst,rt);
        a.wins+=x.rank===1?1:0;a.top3+=x.rank<=3?1:0;
        a.overtakes+=x.overtakes||0;a.collisions+=x.collisions||0;
        a.rankGain=Math.max(a.rankGain,x.rankGain||0);
      }
    }
    rows.forEach(a=>{
      a.rating=a.rounds?a.ratingSum/a.rounds:0;
      if(!a.rounds){a.best=0;a.worst=0;}
    });
    return rows.sort((a,b)=>b.rating-a.rating || b.wins-a.wins || a.name.localeCompare(b.name));
  }

  function ratingGrade(r){
    if(r>=9.0) return "S";
    if(r>=8.3) return "A+";
    if(r>=7.7) return "A";
    if(r>=7.0) return "B+";
    if(r>=6.4) return "B";
    if(r>=5.7) return "C";
    return "D";
  }

  function buildMatchAwards(){
    const all=[];
    for(const r of roundHistory){
      for(const p of r.players) all.push({...p,round:r.round});
    }
    if(!all.length) return [];

    const agg=new Map();
    for(const x of all){
      let a=agg.get(x.index);
      if(!a){
        a={index:x.index,name:x.name,team:x.team,points:0,wins:0,overtakes:0,collisions:0,avoids:0,leadMs:0,bestSector:Infinity,rankSum:0,rounds:0};
        agg.set(x.index,a);
      }
      a.points+=x.points;
      a.wins+=x.rank===1?1:0;
      a.overtakes+=x.overtakes||0;
      a.collisions+=x.collisions||0;
      a.avoids+=x.avoids||0;
      a.leadMs+=x.leadMs||0;
      if(x.bestSector!=null) a.bestSector=Math.min(a.bestSector,x.bestSector);
      a.rankSum+=x.rank;
      a.rounds++;
    }
    const arr=[...agg.values()];
    const mvp=[...arr].sort((a,b)=>
      (b.points+b.wins*4+b.overtakes*.7+b.leadMs/12000-b.collisions*1.2)-
      (a.points+a.wins*4+a.overtakes*.7+a.leadMs/12000-a.collisions*1.2)
    )[0];
    const pass=[...arr].sort((a,b)=>b.overtakes-a.overtakes || a.rankSum/a.rounds-b.rankSum/b.rounds)[0];
    const clean=[...arr].sort((a,b)=>a.collisions-b.collisions || a.rankSum/a.rounds-b.rankSum/b.rounds)[0];
    const sector=[...arr].filter(a=>Number.isFinite(a.bestSector)).sort((a,b)=>a.bestSector-b.bestSector)[0];

    const result=[
      {label:"경기 MVP",name:mvp.name,value:`${mvp.points>0?"+":""}${mvp.points}점 · ${mvp.wins}승`},
      {label:"최다 추월",name:pass.name,value:`추월 ${pass.overtakes}회`},
      {label:"무충돌 베스트",name:clean.name,value:`충돌 ${clean.collisions}회 · 평균 ${(clean.rankSum/clean.rounds).toFixed(1)}위`}
    ];
    if(sector) result.push({label:"최고 구간기록",name:sector.name,value:formatTime(sector.bestSector)});
    return result;
  }


  function aggregateTelemetry(){
    const map=new Map();
    for(const r of roundHistory){
      for(const x of r.players){
        let a=map.get(x.index);
        if(!a){
          a={index:x.index,name:x.name,team:x.team,rounds:0,controls:0,controlOK:0,
            zigzag:0,backcon:0,stopcon:0,wide:0,
            zigzagOK:0,backconOK:0,stopconOK:0,wideOK:0,
            inside:0,extreme:0,distance:0,efficiency:0,rankGain:0,
            passInside:0,passOutside:0,passWait:0,traces:[],deathPoints:[],startReactionSum:0,
            rankSum:0,timeSum:0,finishes:0};
          map.set(x.index,a);
        }
        a.rounds++;
        a.controls+=x.controlAttempts||0;
        a.controlOK+=x.controlSuccesses||0;
        const cb=x.controlByType||{};
        for(const k of ["zigzag","backcon","stopcon","wide"]){
          a[k]+=(cb[k]?.attempts||0);
          a[k+"OK"]+=(cb[k]?.successes||0);
        }
        a.inside+=x.insideRate||0;
        a.extreme+=x.extremeInsideRate||0;
        a.distance+=x.distance||0;
        a.efficiency+=x.efficiency||0;
        a.startReactionSum+=x.startReactionMs||0;
        a.rankSum+=x.rank||0;
        if(Number.isFinite(x.time)){a.timeSum+=x.time;a.finishes++;}
        if(x.deathPoints?.length) a.deathPoints.push(...x.deathPoints.map(d=>({...d,round:r.round})));
        a.rankGain=Math.max(a.rankGain,x.rankGain||0);
        a.passInside+=(x.passPlans?.inside||0);
        a.passOutside+=(x.passPlans?.outside||0);
        a.passWait+=(x.passPlans?.waitCut||0);
        if(x.trace?.length) a.traces.push({round:r.round,points:x.trace});
      }
    }
    return [...map.values()].map(a=>({
      ...a,
      controlRate:a.controls?100*a.controlOK/a.controls:0,
      avgInside:a.rounds?a.inside/a.rounds:0,
      avgExtreme:a.rounds?a.extreme/a.rounds:0,
      avgEfficiency:a.rounds?a.efficiency/a.rounds:0,
      avgStartReaction:a.rounds?a.startReactionSum/a.rounds:0,
      avgRank:a.rounds?a.rankSum/a.rounds:0,
      avgTime:a.finishes?a.timeSum/a.finishes:0
    })).sort((a,b)=>(playerTournament[b.index]?.total||0)-(playerTournament[a.index]?.total||0));
  }

  function drawTelemetryTrace(playerIndex,roundNum){
    const canvas=document.getElementById("traceCanvas");
    const title=document.getElementById("traceTitle");
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    const agg=aggregateTelemetry().find(a=>a.index===playerIndex);
    if(!agg) return;
    const trace=agg.traces.find(t=>t.round===roundNum)||agg.traces[agg.traces.length-1];
    if(!trace) return;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(map.complete){
      ctx.globalAlpha=.72;
      ctx.drawImage(map,0,0,canvas.width,canvas.height);
      ctx.globalAlpha=1;
    }
    const sx=canvas.width/MAP_W, sy=canvas.height/MAP_H;
    ctx.lineWidth=2.4;
    ctx.beginPath();
    trace.points.forEach((pt,i)=>{
      const x=pt[0]*sx,y=pt[1]*sy;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    if(trace.points.length){
      const a=trace.points[0],b=trace.points[trace.points.length-1];
      ctx.beginPath();ctx.arc(a[0]*sx,a[1]*sy,4,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(b[0]*sx,b[1]*sy,4,0,Math.PI*2);ctx.fill();
    }
    if(title) title.textContent=`${agg.name} · ${trace.round}R 실제 주행 궤적`;
  }

  function renderTelemetryPanel(){
    const body=document.getElementById("telemetryBody");
    const picks=document.getElementById("tracePicks");
    if(!body||!picks) return;
    const rows=aggregateTelemetry();
    body.innerHTML=rows.map(a=>{
      const deaths=a.deathPoints.length
        ? a.deathPoints.slice(-4).map(d=>{const b=d.blackbox||{};const m=b.modeCounts||{};return `R${d.round} ${d.progressPct}% ${DEATH_CAUSE_KO[d.cause]||d.cause||"접촉"} [시야${b.maxSeen??'-'} 클릭${b.clickCount??'-'} R${m.race||0}/E${(m.evade||0)+(m.diag||0)+(m.wide||0)+(m.zigzag||0)+(m.spin||0)}]`;}).join(" · ")
        : "-";
      const pb=loadRecordBook().players[a.name];
      return `<tr>
        <td><div class="table-player">${avatarHtml(a.index,"table-avatar")}<button class="trace-player player-link" data-player="${a.index}">${a.name}</button></div></td>
        <td><b>${a.avgRank.toFixed(2)}위</b></td>
        <td>${a.avgTime?formatTime(a.avgTime):"-"}</td>
        <td>${pb==null?"-":formatTime(pb)}</td>
        <td>${a.deathPoints.length}회${deaths!=="-"?` · ${deaths}`:""}</td>
        <td>${a.zigzag}</td>
        <td>${a.backcon}</td>
        <td>${a.avgInside.toFixed(0)}%</td>
        <td>${(a.avgStartReaction/1000).toFixed(3)}s</td>
      </tr>`;
    }).join("");

    picks.innerHTML=rows.map(a=>`<button class="tracePick" data-player="${a.index}">${a.name}</button>`).join("");
    const choose=(idx)=>{
      const a=rows.find(x=>x.index===idx);
      if(!a||!a.traces.length) return;
      drawTelemetryTrace(idx,a.traces[a.traces.length-1].round);
    };
    body.querySelectorAll(".trace-player").forEach(el=>el.addEventListener("click",()=>choose(Number(el.dataset.player))));
    picks.querySelectorAll(".tracePick").forEach(el=>el.addEventListener("click",()=>choose(Number(el.dataset.player))));
    if(rows.length) choose(rows[0].index);
  }


  // v2.24: rule-based post-race analysis built only from actual match telemetry.
  function playerMatchAnalysis(index){
    const rounds=[];
    for(const r of roundHistory){
      const x=r.players.find(p=>p.index===index);
      if(x) rounds.push({...x,round:r.round});
    }
    if(!rounds.length) return null;

    const p=players[index];
    const avgRank=rounds.reduce((s,x)=>s+x.rank,0)/rounds.length;
    const avgRating=rounds.reduce((s,x)=>s+(x.rating||roundPerformanceRating(x)),0)/rounds.length;
    const wins=rounds.filter(x=>x.rank===1).length;
    const top3=rounds.filter(x=>x.rank<=3).length;
    const overtakes=rounds.reduce((s,x)=>s+(x.overtakes||0),0);
    const collisions=rounds.reduce((s,x)=>s+(x.collisions||0),0);
    const avoids=rounds.reduce((s,x)=>s+(x.avoids||0),0);
    const controls=rounds.reduce((s,x)=>s+(x.controlAttempts||0),0);
    const controlOK=rounds.reduce((s,x)=>s+(x.controlSuccesses||0),0);
    const controlRate=controls?controlOK/controls:1;
    const leadMs=rounds.reduce((s,x)=>s+(x.leadMs||0),0);
    const rankGain=Math.max(...rounds.map(x=>x.rankGain||0));
    const avgEff=rounds.reduce((s,x)=>s+(x.efficiency||100),0)/rounds.length;
    const inside=rounds.reduce((s,x)=>s+(x.insideRate||0),0)/rounds.length;
    const extreme=rounds.reduce((s,x)=>s+(x.extremeInsideRate||0),0)/rounds.length;
    const bestRound=[...rounds].sort((a,b)=>(b.rating||0)-(a.rating||0) || a.rank-b.rank)[0];
    const worstRound=[...rounds].sort((a,b)=>(a.rating||0)-(b.rating||0) || b.rank-a.rank)[0];

    const strengths=[], weaknesses=[];
    if(wins) strengths.push(`${wins}개 라운드 우승으로 결과를 만들었다`);
    else if(top3>=2) strengths.push(`${top3}개 라운드 상위 3위로 꾸준하게 상위권을 유지했다`);
    if(overtakes>=8) strengths.push(`총 ${overtakes}회 추월로 공격적인 레이스를 만들었다`);
    else if(overtakes>=4) strengths.push(`추월 ${overtakes}회로 순위 싸움에서 존재감을 보였다`);
    if(rankGain>=4) strengths.push(`한 라운드에서 최대 ${rankGain}계단을 끌어올리는 역전 능력을 보였다`);
    if(controlRate>=.90 && controls>=3) strengths.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 실행력이 안정적이었다`);
    if(collisions===0) strengths.push(`5라운드 동안 충돌 없이 완주했다`);
    if(leadMs>=8000) strengths.push(`선두를 ${(leadMs/1000).toFixed(1)}초 유지하며 경기 주도권을 잡았다`);
    if(inside>=48) strengths.push(`인코스 활용률 ${inside.toFixed(0)}%로 코너 공략이 적극적이었다`);
    if(extreme>=20) strengths.push(`극인코스 ${extreme.toFixed(0)}%로 과감한 최단라인 공략을 보여줬다`);
    if(avgEff>=100) strengths.push(`라인효율 ${avgEff.toFixed(1)}%로 이동거리 관리가 좋았다`);

    if(collisions>=3) weaknesses.push(`충돌 ${collisions}회가 순위와 기록 손실의 가장 큰 원인이었다`);
    else if(collisions>=1) weaknesses.push(`충돌 ${collisions}회로 불필요한 정지 손실이 발생했다`);
    if(controlRate<.72 && controls>=3) weaknesses.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 실행 실수가 많았다`);
    else if(controlRate<.84 && controls>=4) weaknesses.push(`컨트롤 성공률 ${(controlRate*100).toFixed(0)}%로 안정성이 다소 부족했다`);
    if(avgRank>=6) weaknesses.push(`평균 ${avgRank.toFixed(1)}위로 상위권 진입 빈도가 부족했다`);
    if(overtakes<=1 && avgRank>4.5) weaknesses.push(`추월이 ${overtakes}회에 그쳐 뒤처진 뒤 순위를 회복하기 어려웠다`);
    if(avgEff<98.7) weaknesses.push(`라인효율 ${avgEff.toFixed(1)}%로 우회·회피 과정에서 이동거리 손실이 컸다`);
    if(worstRound && bestRound && (bestRound.rating-worstRound.rating)>=1.1)
      weaknesses.push(`${bestRound.round}R과 ${worstRound.round}R의 경기력 편차가 크게 나타났다`);

    if(!strengths.length){
      if(avgRating>=7) strengths.push(`평점 ${avgRating.toFixed(1)}로 전체적으로 무난한 경기력을 유지했다`);
      else strengths.push(`큰 사고 없이 경기 데이터를 쌓았지만 뚜렷한 강점은 만들지 못했다`);
    }
    if(!weaknesses.length){
      weaknesses.push(`큰 약점은 없었으며 다음 경기에서는 추월과 선두 유지 시간을 더 늘릴 여지가 있다`);
    }

    let headline;
    if(avgRating>=8.6) headline="압도적인 경기력";
    else if(avgRating>=7.8) headline="상위권을 만든 좋은 경기";
    else if(avgRating>=7.0) headline="안정적인 경기";
    else if(avgRating>=6.2) headline="기복이 있었던 경기";
    else headline="개선이 필요한 경기";

    let summary=`${headline}. 평균 ${avgRank.toFixed(2)}위, 평점 ${avgRating.toFixed(1)}. `;
    if(wins) summary+=`${wins}승을 기록했고 `;
    if(overtakes) summary+=`총 ${overtakes}회 추월했다. `;
    summary+=collisions?`충돌은 ${collisions}회 발생했다.`:`무충돌로 마쳤다.`;

    return {
      index,name:p.name,team:p.team,avgRank,avgRating,wins,top3,overtakes,collisions,
      controls,controlRate,leadMs,rankGain,avgEff,inside,extreme,
      bestRound:bestRound?.round,worstRound:worstRound?.round,
      strengths:strengths.slice(0,3),weaknesses:weaknesses.slice(0,3),summary
    };
  }

  function buildMatchAnalysisReport(){
    const reports=players.map((_,i)=>playerMatchAnalysis(i)).filter(Boolean)
      .sort((a,b)=>b.avgRating-a.avgRating || a.avgRank-b.avgRank);

    const avg=(arr,key)=>arr.length?arr.reduce((s,x)=>s+x[key],0)/arr.length:0;
    const teamSummary={};
    for(const team of ["A","B","C","D"]){
      const rows=reports.filter(x=>x.team===team);
      teamSummary[team]={
        rating:avg(rows,"avgRating"),
        collisions:rows.reduce((s,x)=>s+x.collisions,0),
        overtakes:rows.reduce((s,x)=>s+x.overtakes,0)
      };
    }

    const allLeaderChanges=roundHistory.reduce((s,r)=>s+(r.leaderChanges||0),0);
    const allOvertakes=roundHistory.reduce((s,r)=>s+(r.totalOvertakes||0),0);
    const winner=teamWinner();
    const standings=teamStandings();
    let matchText;
    if(!winner){
      matchText=`4팀 최고점이 동률로 경기를 마쳤다. 빨강 ${teamTotals.A}점, 파랑 ${teamTotals.B}점, 노랑 ${teamTotals.C}점, 초록 ${teamTotals.D}점.`;
    }else{
      matchText=`${teamLabel(winner)}이 ${teamTotals[winner]}점으로 승리했다. `+
        `빨강 ${teamTotals.A}점, 파랑 ${teamTotals.B}점, 노랑 ${teamTotals.C}점, 초록 ${teamTotals.D}점.`;
    }
    matchText+=` 전체 5라운드 기준 선두교체 ${allLeaderChanges}회, 순위상승 ${allOvertakes}회를 기록했다.`;
    return {reports,teamSummary,matchText};
  }

  function renderMatchAnalysis(){
    const wrap=document.getElementById("matchAnalysis");
    if(!wrap) return;
    const data=buildMatchAnalysisReport();
    wrap.innerHTML=`
      <div class="analysis-overview">
        <span>MATCH REVIEW</span>
        <b>${data.matchText}</b>
      </div>
      <div class="analysis-grid">
        ${data.reports.map((a,i)=>`
          <article class="analysis-card ${i===0?"best":""}">
            <div class="analysis-head">
              <div class="analysis-player">${avatarHtml(a.index,"analysis-avatar")}<div><span>${teamLabel(a.team)}</span><b>${a.name}</b></div></div>
              <strong>${a.avgRating.toFixed(1)}</strong>
            </div>
            <p>${a.summary}</p>
            <div class="analysis-block good"><b>잘한 점</b>${a.strengths.map(x=>`<span>+ ${x}</span>`).join("")}</div>
            <div class="analysis-block bad"><b>아쉬운 점</b>${a.weaknesses.map(x=>`<span>− ${x}</span>`).join("")}</div>
            <small>평균 ${a.avgRank.toFixed(2)}위 · 상위 3위 ${a.top3}회 · 추월 ${a.overtakes} · 충돌 ${a.collisions} · 컨트롤 ${(a.controlRate*100).toFixed(0)}%</small>
          </article>`).join("")}
      </div>`;
  }


  function prepChart(canvas){
    if(!canvas) return null;
    const ctx=canvas.getContext("2d");
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="rgba(4,9,16,.86)";
    ctx.fillRect(0,0,w,h);
    return {ctx,w,h};
  }

  function drawRankChart(){
    const canvas=document.getElementById("rankChart");
    const legend=document.getElementById("rankLegend");
    const c=prepChart(canvas); if(!c) return;
    const {ctx,w,h}=c, L=56,R=24,T=28,B=42;
    ctx.strokeStyle="rgba(255,255,255,.12)";ctx.lineWidth=1;
    ctx.font="12px system-ui";ctx.fillStyle="rgba(255,255,255,.65)";
    ctx.textAlign="right";ctx.textBaseline="middle";
    for(let rank=1;rank<=12;rank++){
      const y=T+(rank-1)*(h-T-B)/11;
      ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(w-R,y);ctx.stroke();
      ctx.fillText(`${rank}위`,L-10,y);
    }
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let r=1;r<=5;r++){
      const x=L+(r-1)*(w-L-R)/4;
      ctx.fillText(`${r}R`,x,h-B+13);
    }

    for(let idx=0;idx<players.length;idx++){
      const pts=[];
      for(let r=1;r<=5;r++){
        const rd=roundHistory.find(q=>q.round===r);
        const x=rd?.players.find(q=>q.index===idx);
        if(x) pts.push({r,rank:x.rank});
      }
      if(!pts.length) continue;
      ctx.strokeStyle=colors[idx];ctx.fillStyle=colors[idx];ctx.lineWidth=3;
      ctx.beginPath();
      pts.forEach((p,i)=>{
        const x=L+(p.r-1)*(w-L-R)/4;
        const y=T+(p.rank-1)*(h-T-B)/11;
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.stroke();
      pts.forEach(p=>{
        const x=L+(p.r-1)*(w-L-R)/2,y=T+(p.rank-1)*(h-T-B)/11;
        ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
      });
    }
    if(legend) legend.innerHTML=players.map(p=>`<span><i style="background:${colors[p.index]}"></i>${avatarHtml(p.index,"legend-avatar")}${p.name}</span>`).join("");
  }

  function drawPerformanceChart(){
    const canvas=document.getElementById("performanceChart");
    const c=prepChart(canvas); if(!c) return;
    const {ctx,w,h}=c;
    const rows=aggregateMatchRatings().slice().sort((a,b)=>b.rating-a.rating);
    const left=120,right=26,top=22,rowH=(h-top-18)/rows.length;
    ctx.font="12px system-ui";ctx.textBaseline="middle";
    rows.forEach((a,i)=>{
      const y=top+i*rowH+rowH/2;
      ctx.fillStyle="rgba(255,255,255,.12)";
      ctx.fillRect(left,y-8,w-left-right,16);
      const ratingWidth=(w-left-right)*Math.max(0,Math.min(1,(a.rating-4)/6));
      ctx.fillStyle=colors[a.index];
      ctx.fillRect(left,y-8,ratingWidth,16);
      ctx.fillStyle="#fff";ctx.textAlign="right";ctx.fillText(a.name,left-12,y);
      ctx.textAlign="left";ctx.fillText(`${a.rating.toFixed(1)}  ·  추월 ${a.overtakes}  ·  충돌 ${a.collisions}`,left+ratingWidth+8,y);
    });
  }

  function drawAllRoutes(roundNum=3){
    const canvas=document.getElementById("allRouteCanvas");
    const legend=document.getElementById("routeLegend");
    const c=prepChart(canvas); if(!c) return;
    const {ctx,w,h}=c;
    if(map.complete){
      ctx.globalAlpha=.66;ctx.drawImage(map,0,0,w,h);ctx.globalAlpha=1;
    }
    const rd=roundHistory.find(r=>r.round===roundNum);
    if(!rd) return;
    const sx=w/MAP_W, sy=h/MAP_H;
    for(const x of rd.players){
      if(!x.trace?.length) continue;
      ctx.strokeStyle=colors[x.index];ctx.lineWidth=2.5;ctx.globalAlpha=.92;
      ctx.beginPath();
      x.trace.forEach((pt,i)=>{
        const px=pt[0]*sx,py=pt[1]*sy;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      });
      ctx.stroke();ctx.globalAlpha=1;
      const end=x.trace[x.trace.length-1];
      ctx.fillStyle=colors[x.index];ctx.beginPath();ctx.arc(end[0]*sx,end[1]*sy,4.5,0,Math.PI*2);ctx.fill();
    }
    if(legend) legend.innerHTML=rd.players.map(x=>`<span><i style="background:${colors[x.index]}"></i>${avatarHtml(x.index,"legend-avatar")}${x.name}</span>`).join("");
    document.querySelectorAll("#routeRoundPicks button").forEach(b=>b.classList.toggle("active",Number(b.dataset.round)===roundNum));
  }

  function renderVisualDashboard(){
    const podium=document.getElementById("visualPodium");
    const picks=document.getElementById("routeRoundPicks");
    if(!podium||!picks) return;
    const ratings=aggregateMatchRatings();
    const scoreRows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || (ratings.find(x=>x.name===b.name)?.rating||0)-(ratings.find(x=>x.name===a.name)?.rating||0));
    podium.innerHTML=scoreRows.slice(0,3).map((pt,i)=>{
      const idx=names.indexOf(pt.name);
      const rt=ratings.find(x=>x.index===idx);
      const medal=i===0?"1위":i===1?"2위":"3위";
      return `<article class="podium-card p${i+1}">
        <div class="podium-rank">${medal}</div>
        ${avatarHtml(idx,"podium-avatar")}
        <div class="podium-copy"><b>${pt.name}</b><span>${teamLabel(pt.team)}</span><strong>${pt.total>0?"+":""}${pt.total}점</strong><small>평점 ${rt?rt.rating.toFixed(1):"-"} · 추월 ${rt?.overtakes||0}</small></div>
      </article>`;
    }).join("");
    picks.innerHTML=[1,2,3,4,5].map(r=>`<button data-round="${r}">${r}R 경로</button>`).join("");
    picks.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>drawAllRoutes(Number(b.dataset.round))));
    drawRankChart();
    drawPerformanceChart();
    drawAllRoutes(roundHistory.length?roundHistory[roundHistory.length-1].round:5);
  }


  function showMatchResults(){
    const panel=document.getElementById("resultPanel");
    const body=document.getElementById("resultBody");
    const teamSummary=document.getElementById("teamResultSummary");

    const winnerTeam=teamWinner();
    const winner=winnerTeam?`${teamLabel(winnerTeam)} 승리`:"무승부";
    const awards=buildMatchAwards();
    const ratings=aggregateMatchRatings();
    const ratingEl=document.getElementById("matchRatings");
    const awardsEl=document.getElementById("matchAwards");
    const timelineEl=document.getElementById("highlightTimeline");
    const autoEl=document.getElementById("autoHighlightClips");
    if(awardsEl){
      awardsEl.innerHTML=awards.map(a=>{
        const idx=names.indexOf(a.name);
        return `<div class="award-card">${avatarHtml(idx,"award-avatar")}<span>${a.label}</span><b>${a.name}</b><small>${a.value}</small></div>`;
      }).join("");
    }
    if(ratingEl){
      const mvp=ratings[0];
      ratingEl.innerHTML=`<div class="rating-mvp">
          ${mvp?avatarHtml(mvp.index,"mvp-avatar"):""}
          <span>경기 MVP</span>
          <b>${mvp?mvp.name:"-"}</b>
          <strong>${mvp?mvp.rating.toFixed(1):"-"}</strong>
          <small>${mvp?ratingGrade(mvp.rating):""}</small>
        </div>
        <div class="rating-grid">${ratings.map((a,i)=>`
          <div class="rating-card ${i===0?"mvp":""}">
            <div class="rating-player">${avatarHtml(a.index,"rating-avatar")}<span>${i+1}. ${a.name}</span></div>
            <b>${a.rating.toFixed(1)}</b>
            <small>${ratingGrade(a.rating)} · 최고평점 ${a.best.toFixed(1)} · 추월 ${a.overtakes} · 충돌 ${a.collisions}</small>
          </div>`).join("")}
        </div>`;
    }
    if(timelineEl){
      timelineEl.innerHTML=tournamentHighlights.length
        ? tournamentHighlights.map(h=>`<div class="highlight-row"><span>R${h.round}</span><b>${h.text}</b></div>`).join("")
        : `<div class="highlight-empty">기록된 하이라이트가 없습니다.</div>`;
    }
    if(autoEl){
      const clips=[];
      for(const [r,marks] of Object.entries(highlightArchive)){
        for(const h of marks) clips.push({round:Number(r),...h});
      }
      clips.sort((a,b)=>b.importance-a.importance || a.round-b.round || a.t-b.t);
      autoEl.innerHTML=clips.slice(0,14).map(h=>`<button class="auto-clip" data-round="${h.round}" data-time="${h.t}" data-player="${h.playerId??-1}" data-photo="${h.type==="PHOTO_FINISH"?1:0}">
        <span>${highlightTypeLabel(h.type)}</span><b>R${h.round} · ${h.text}</b>
      </button>`).join("") || `<div class="highlight-empty">자동 하이라이트가 없습니다.</div>`;
      autoEl.querySelectorAll(".auto-clip").forEach(b=>b.addEventListener("click",()=>{
        replayFocusId=Number(b.dataset.player);
        openReplay(Number(b.dataset.round),Math.max(0,Number(b.dataset.time)-1400),b.dataset.photo==="1");
      }));
    }
    const resultTeams=[
      {id:"A",name:"빨강팀",short:"빨강",color:"#ff4d4d",rgb:"255,77,77",score:teamTotals.A},
      {id:"B",name:"파랑팀",short:"파랑",color:"#4d8dff",rgb:"77,141,255",score:teamTotals.B},
      {id:"C",name:"노랑팀",short:"노랑",color:"#ffd84d",rgb:"255,216,77",score:teamTotals.C},
      {id:"D",name:"초록팀",short:"초록",color:"#39d46a",rgb:"57,212,106",score:teamTotals.D}
    ];
    const rankedTeams=[...resultTeams].sort((a,b)=>b.score-a.score);
    const minTeamScore=Math.min(...resultTeams.map(t=>t.score),0);
    const maxTeamScore=Math.max(...resultTeams.map(t=>t.score),1);
    const scoreSpan=Math.max(1,maxTeamScore-minTeamScore);
    const totalPositive=resultTeams.reduce((s,t)=>s+Math.max(0,t.score),0)||1;

    // Cumulative points by round for the line chart.
    const cumulative={A:[],B:[],C:[],D:[]};
    const running={A:0,B:0,C:0,D:0};
    roundHistory.forEach(r=>{
      for(const t of resultTeams){
        running[t.id]+=r.team[t.id]||0;
        cumulative[t.id].push(running[t.id]);
      }
    });
    const allCum=resultTeams.flatMap(t=>[0,...cumulative[t.id]]);
    const minCum=Math.min(0,...allCum),maxCum=Math.max(1,...allCum);
    const cumSpan=Math.max(1,maxCum-minCum);
    const chartW=640,chartH=190,padL=42,padR=18,padT=18,padB=32;
    const xAt=i=>padL+(chartW-padL-padR)*(i/5);
    const yAt=v=>padT+(chartH-padT-padB)*(1-(v-minCum)/cumSpan);
    const gridVals=[minCum,minCum+cumSpan*.25,minCum+cumSpan*.5,minCum+cumSpan*.75,maxCum];
    const lineSvg=`<svg class="team-result-line-svg" viewBox="0 0 ${chartW} ${chartH}" role="img" aria-label="라운드별 누적 팀 점수">
      ${gridVals.map(v=>`<line x1="${padL}" y1="${yAt(v).toFixed(1)}" x2="${chartW-padR}" y2="${yAt(v).toFixed(1)}" class="tr-grid"/><text x="${padL-8}" y="${(yAt(v)+4).toFixed(1)}" class="tr-axis" text-anchor="end">${Math.round(v)}</text>`).join("")}
      ${[1,2,3,4,5].map((r,i)=>`<text x="${xAt(i+1).toFixed(1)}" y="${chartH-9}" class="tr-axis" text-anchor="middle">${r}R</text>`).join("")}
      ${resultTeams.map(t=>{
        const vals=[0,...cumulative[t.id]];
        const pts=vals.map((v,i)=>`${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
        return `<polyline points="${pts}" fill="none" stroke="${t.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          ${vals.slice(1).map((v,i)=>`<circle cx="${xAt(i+1).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="5" fill="${t.color}" stroke="#07111d" stroke-width="2"><title>${t.name} ${i+1}R 누적 ${v}</title></circle>`).join("")}`;
      }).join("")}
    </svg>`;

    teamSummary.innerHTML=`<div class="team-result-hero">
        <div class="winner">${winnerTeam?`<span class="winner-dot team-result-${winnerTeam}"></span>${winner}`:winner}</div>
        <div class="team-result-rank-grid">${rankedTeams.map((t,i)=>{
          const pct=Math.max(8,((t.score-minTeamScore)/scoreSpan)*100);
          return `<div class="team-result-rank-card team-result-card-${t.id}" style="--team:${t.color};--team-rgb:${t.rgb}">
            <div class="tr-rank">${i+1}</div>
            <div class="tr-team-name"><span class="tr-color-dot"></span>${t.name}</div>
            <div class="tr-score">${t.score}</div>
            <div class="tr-score-track"><i style="width:${pct.toFixed(1)}%"></i></div>
          </div>`;
        }).join("")}</div>
      </div>

      <div class="team-result-dashboard">
        <section class="team-result-panel team-result-trend">
          <div class="team-result-head"><b>라운드별 누적 점수</b><span>흐름 한눈에 보기</span></div>
          ${lineSvg}
          <div class="tr-legend">${resultTeams.map(t=>`<span><i style="background:${t.color}"></i>${t.name}</span>`).join("")}</div>
        </section>

        <section class="team-result-panel">
          <div class="team-result-head"><b>라운드 점수 상세</b><span>팀 색상으로 구분</span></div>
          <div class="round-score-matrix">
            <div class="rsm-head"><span>팀</span>${roundHistory.map(r=>`<b>${r.round}R</b>`).join("")}<b>합계</b></div>
            ${resultTeams.map(t=>`<div class="rsm-row" style="--team:${t.color};--team-rgb:${t.rgb}">
              <strong><i></i>${t.short}</strong>
              ${roundHistory.map(r=>{
                const v=r.team[t.id]||0;
                return `<span class="${v>0?"plus":v<0?"minus":"zero"}">${v>0?"+":""}${v}</span>`;
              }).join("")}
              <b>${t.score>0?"+":""}${t.score}</b>
            </div>`).join("")}
          </div>
        </section>
      </div>

      <div class="team-result-share">
        <div class="team-result-head"><b>양수 점수 점유율</b><span>팀별 최종 점수 비중</span></div>
        <div class="tr-share-bar">${resultTeams.map(t=>{
          const w=Math.max(0,t.score)/totalPositive*100;
          return `<i style="width:${w.toFixed(2)}%;background:${t.color}" title="${t.name} ${w.toFixed(1)}%"></i>`;
        }).join("")}</div>
        <div class="tr-share-labels">${resultTeams.map(t=>{
          const w=Math.max(0,t.score)/totalPositive*100;
          return `<span style="--team:${t.color}"><i></i><b>${t.name}</b> ${w.toFixed(1)}%</span>`;
        }).join("")}</div>
      </div>`;

    const rows=Object.values(playerTournament).sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name));
    body.innerHTML=rows.map((pt,i)=>{
      const r=[1,2,3,4,5].map(n=>{
        const x=pt.rounds.find(v=>v.round===n);
        return x ? `${x.rank}위 / ${x.points>0?"+":""}${x.points}` : "-";
      });
      return `<tr>
        <td>${i+1}</td>
        <td><span class="team-mini team-${pt.team.toLowerCase()}">${pt.team}</span></td>
        <td><div class="table-player">${avatarHtml(names.indexOf(pt.name),"table-avatar")}<button class="result-name player-link" data-player="${names.indexOf(pt.name)}">${pt.name}</button></div></td>
        <td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td>
        <td><b>${pt.total>0?"+":""}${pt.total}</b></td>
      </tr>`;
    }).join("");
    body.querySelectorAll(".result-name").forEach(el=>{
      el.addEventListener("click",()=>openPlayerCard(players[Number(el.dataset.player)]));
    });
    renderTelemetryPanel();
    renderMatchAnalysis();
    renderVisualDashboard();
    panel.classList.remove("hidden");
  }



  // v2.28: REAL live-race balance archive.
  // Unlike the fast Monte-Carlo test below, this stores completed rounds from
  // the actual canvas race engine. Keep only recent rounds so localStorage stays small.
  const LIVE_BALANCE_KEY="observerFM_v228_live_balance";
  const LIVE_BALANCE_MAX=500;

  function loadLiveBalance(){
    try{
      const rows=JSON.parse(localStorage.getItem(LIVE_BALANCE_KEY)||"[]");
      return Array.isArray(rows)?rows:[];
    }catch(e){ return []; }
  }

  function saveLiveBalance(rows){
    try{localStorage.setItem(LIVE_BALANCE_KEY,JSON.stringify(rows.slice(-LIVE_BALANCE_MAX)));}catch(e){}
  }

  function recordLiveBalanceRound(result){
    if(!result || !result.players?.length) return;
    const rows=loadLiveBalance();
    const top1=result.players[0], top2=result.players[1];
    rows.push({
      t:Date.now(),
      round:result.round,
      leaderChanges:result.leaderChanges||0,
      totalOvertakes:result.totalOvertakes||result.players.reduce((s,x)=>s+(x.overtakes||0),0),
      photoFinish:!!(top1&&top2&&Math.abs(top2.time-top1.time)<=500),
      winnerTime:top1?.time||0,
      lastTime:result.players[result.players.length-1]?.time||0,
      players:result.players.map(x=>({
        index:x.index,name:x.name,rank:x.rank,time:x.time,
        collisions:x.collisions||0,overtakes:x.overtakes||0,avoids:x.avoids||0,
        controls:x.controlAttempts||0,controlOK:x.controlSuccesses||0,
        rating:x.rating||roundPerformanceRating(x),raceForm:x.raceForm??1,
        efficiency:x.efficiency||0
      }))
    });
    saveLiveBalance(rows);
  }

  function liveBalanceReport(){
    const rounds=loadLiveBalance();
    if(!rounds.length) return {rounds:[],players:[],warnings:[]};

    const agg=players.map(p=>({index:p.index,name:p.name,starts:0,wins:0,top3:0,
      rankSum:0,timeSum:0,collisions:0,overtakes:0,controls:0,controlOK:0,
      ratingSum:0,upsets:0}));

    let winnerTime=0,lastTime=0,collisions=0,overtakes=0,leaderChanges=0,photo=0;
    let upsetRounds=0;

    for(const r of rounds){
      winnerTime+=r.winnerTime||0; lastTime+=r.lastTime||0;
      leaderChanges+=r.leaderChanges||0; photo+=r.photoFinish?1:0;
      let roundUpset=false;

      for(const x of r.players||[]){
        const a=agg[x.index];
        if(!a) continue;
        a.starts++; a.wins+=x.rank===1?1:0; a.top3+=x.rank<=3?1:0;
        a.rankSum+=x.rank; a.timeSum+=x.time||0;
        a.collisions+=x.collisions||0; a.overtakes+=x.overtakes||0;
        a.controls+=x.controls||0; a.controlOK+=x.controlOK||0;
        a.ratingSum+=x.rating||0;
        collisions+=x.collisions||0; overtakes+=x.overtakes||0;
      }

      // Upset = winner was outside top-3 by fixed OVR/ability ordering.
      const winner=(r.players||[]).find(x=>x.rank===1);
      if(winner){
        const abilityOrder=players.map(p=>({
          i:p.index,
          o:(p.stats.pace+p.stats.cornering+p.stats.insideLine+p.stats.routeReading+
             p.stats.avoidance+p.stats.control+p.stats.consistency+p.stats.focus)/8
        })).sort((a,b)=>b.o-a.o);
        const seed=abilityOrder.findIndex(q=>q.i===winner.index)+1;
        if(seed>=4){roundUpset=true;agg[winner.index].upsets++;}
      }
      if(roundUpset) upsetRounds++;
    }

    const n=rounds.length;
    const valid=agg.filter(a=>a.starts).map(a=>({
      ...a,
      winRate:100*a.wins/a.starts,
      top3Rate:100*a.top3/a.starts,
      avgRank:a.rankSum/a.starts,
      avgTime:a.timeSum/a.starts/1000,
      collisionRate:a.collisions/a.starts,
      overtakeRate:a.overtakes/a.starts,
      controlRate:a.controls?100*a.controlOK/a.controls:100,
      avgRating:a.ratingSum/a.starts
    })).sort((a,b)=>b.winRate-a.winRate || a.avgRank-b.avgRank);

    const maxWin=valid.length?Math.max(...valid.map(a=>a.winRate)):0;
    const minWin=valid.length?Math.min(...valid.map(a=>a.winRate)):0;
    const avgWinner=winnerTime/n/1000;
    const avgLast=lastTime/n/1000;
    const avgCollisions=collisions/n;
    const avgOvertakes=overtakes/n;
    const warnings=[];

    if(n<30) warnings.push(`표본 부족 · 실전 ${n}라운드 (30라운드 이상 권장)`);
    if(n>=30 && maxWin>28) warnings.push(`우승 편중 가능성 · 최고 우승률 ${maxWin.toFixed(1)}%`);
    if(n>=30 && maxWin-minWin>20) warnings.push(`선수간 우승률 편차 큼 · ${(maxWin-minWin).toFixed(1)}%p`);
    if(avgWinner<45) warnings.push(`선두 평균 기록이 목표보다 빠를 수 있음 · ${avgWinner.toFixed(1)}초`);
    if(avgWinner>65) warnings.push(`선두 평균 기록이 목표보다 느릴 수 있음 · ${avgWinner.toFixed(1)}초`);
    if(avgCollisions<.35) warnings.push(`충돌이 매우 적음 · 경기당 ${avgCollisions.toFixed(2)}회`);
    if(avgCollisions>3.0) warnings.push(`충돌이 많음 · 경기당 ${avgCollisions.toFixed(2)}회`);
    if(avgOvertakes<5) warnings.push(`추월이 적음 · 경기당 ${avgOvertakes.toFixed(1)}회`);
    const upsetRate=100*upsetRounds/n;
    if(n>=30 && upsetRate<5) warnings.push(`이변 빈도가 낮음 · ${upsetRate.toFixed(1)}%`);
    if(n>=30 && upsetRate>40) warnings.push(`이변 빈도가 높음 · ${upsetRate.toFixed(1)}%`);

    return {
      rounds,players:valid,warnings,
      avgWinner,avgLast,avgSpread:avgLast-avgWinner,
      avgCollisions,avgOvertakes,avgLeaderChanges:leaderChanges/n,
      photoRate:100*photo/n,upsetRate
    };
  }

  function renderLiveBalance(){
    const summary=document.getElementById("liveBalanceSummary");
    const body=document.getElementById("liveBalanceBody");
    const warnings=document.getElementById("liveBalanceWarnings");
    if(!summary||!body||!warnings) return;
    const r=liveBalanceReport();

    if(!r.rounds.length){
      summary.innerHTML=`<div class="balance-empty">아직 저장된 실전 라운드가 없습니다. 실제 레이스를 완료하면 자동 누적됩니다.</div>`;
      body.innerHTML="";
      warnings.innerHTML="";
      return;
    }

    summary.innerHTML=`
      <div><span>실전 표본</span><b>${r.rounds.length}R</b></div>
      <div><span>평균 우승기록</span><b>${r.avgWinner.toFixed(2)}s</b></div>
      <div><span>평균 최하위</span><b>${r.avgLast.toFixed(2)}s</b></div>
      <div><span>P1-P8</span><b>${r.avgSpread.toFixed(2)}s</b></div>
      <div><span>경기당 충돌</span><b>${r.avgCollisions.toFixed(2)}</b></div>
      <div><span>경기당 추월</span><b>${r.avgOvertakes.toFixed(1)}</b></div>
      <div><span>선두교체</span><b>${r.avgLeaderChanges.toFixed(1)}</b></div>
      <div><span>포토피니시</span><b>${r.photoRate.toFixed(1)}%</b></div>
      <div><span>이변 발생률</span><b>${r.upsetRate.toFixed(1)}%</b></div>`;

    body.innerHTML=r.players.map(a=>`<tr>
      <td>${a.name}</td><td>${a.winRate.toFixed(1)}%</td><td>${a.top3Rate.toFixed(1)}%</td>
      <td>${a.avgRank.toFixed(2)}</td><td>${a.avgTime.toFixed(2)}s</td>
      <td>${a.avgRating.toFixed(2)}</td><td>${a.collisionRate.toFixed(2)}</td>
      <td>${a.overtakeRate.toFixed(1)}</td><td>${a.controlRate.toFixed(1)}%</td>
      <td>${a.upsets}</td></tr>`).join("");

    warnings.innerHTML=r.warnings.length
      ? r.warnings.map(x=>`<div class="balance-warning">⚠ ${x}</div>`).join("")
      : `<div class="balance-ok">실전 데이터 기준 큰 자동 경고 없음</div>`;
  }

  function resetLiveBalance(){
    if(!confirm("실전 밸런스 누적 데이터를 초기화할까요?")) return;
    localStorage.removeItem(LIVE_BALANCE_KEY);
    renderLiveBalance();
  }

  // v2.16: fast Monte-Carlo balance test.
  // This intentionally avoids canvas/DOM race rendering and approximates the live
  // race from the same fixed player stats/styles. It is a balance diagnostic, not
  // a replacement for the normal race simulation.
  function balancePlayerModel(p){
    const s=p.stats;
    return {
      pace:(s.pace*.34+s.acceleration*.16+s.cornering*.14+s.insideLine*.10+
            s.routeReading*.08+s.control*.06+s.consistency*.05+s.endurance*.04+s.luck*.03)/100,
      safety:(s.avoidance*.24+s.reaction*.16+s.prediction*.19+s.control*.12+
              s.stability*.10+s.riskControl*.10+s.focus*.09)/100,
      pass:(s.aggression*.22+s.pressure*.16+s.insideLine*.18+s.routeReading*.16+
            s.prediction*.14+s.control*.14)/100,
      control:(s.control*.28+s.reaction*.22+s.stability*.18+s.focus*.15+s.pressure*.17)/100
    };
  }

  function simulateBalanceRace(){
    const models=players.map(balancePlayerModel);
    const racers=players.map((p,i)=>{
      const m=models[i];
      const form=(Math.random()-.5)*.038;
      const start=((p.stats.start-85)/27)*.018+((p.stats.reaction-85)/27)*.010;
      const base=55.0 - (m.pace-.85)*25.0 - start + form*8.0;
      const controls=Math.max(0,Math.round(2.1+Math.random()*3.8+(1-m.safety)*3.0));
      let controlOK=0;
      for(let k=0;k<controls;k++){
        const chance=Math.max(.66,Math.min(.97,.70+m.control*.27));
        if(Math.random()<chance) controlOK++;
      }
      const collisions=(Math.random()<Math.max(.035,.19-m.safety*.15)?1:0) +
        (Math.random()<Math.max(.006,.055-m.safety*.045)?1:0);
      const avoids=Math.round(4+m.safety*5+Math.random()*4);
      const passPotential=Math.max(0,Math.round(1+m.pass*4+Math.random()*4));
      const controlLoss=(controls-controlOK)*.24;
      const collisionLoss=collisions*(1.75+Math.random()*.65);
      const riskSwing=(Math.random()-.5)*(1.25+m.pass*.8);
      const time=Math.max(42,base+controlLoss+collisionLoss+riskSwing);
      return {i,p,m,time,collisions,avoids,controls,controlOK,passPotential,rating:0};
    });

    racers.sort((a,b)=>a.time-b.time);
    let overtakes=0;
    racers.forEach((r,rank)=>{
      r.rank=rank+1;
      const startRank=r.i+1;
      const gain=Math.max(0,startRank-r.rank);
      r.overtakes=Math.max(gain,Math.min(7,r.passPotential+Math.floor(Math.random()*2)));
      const cr=r.controls?r.controlOK/r.controls:1;
      r.rating=Math.max(4,Math.min(10,
        6+(9-r.rank)*.19+Math.min(1.05,r.overtakes*.11)+(cr-.75)*.90-r.collisions*.42));
      overtakes+=r.overtakes;
    });
    const leaderChanges=Math.max(0,Math.min(10,Math.round(overtakes/4+(Math.random()*3-1))));
    return {racers,overtakes,leaderChanges,p1:racers[0].time,p8:racers[7].time};
  }

  function runBalanceTest(count){
    const started=performance.now();
    const agg=players.map(p=>({name:p.name,races:0,wins:0,top3:0,rankSum:0,timeSum:0,
      best:Infinity,worst:0,collisions:0,avoids:0,overtakes:0,controls:0,controlOK:0,ratingSum:0,upsets:0}));
    let totalP1=0,totalP8=0,totalSpread=0,totalCollisions=0,totalOvertakes=0,totalLeaderChanges=0,clean=0,upsetCount=0;

    for(let n=0;n<count;n++){
      const r=simulateBalanceRace();
      totalP1+=r.p1; totalP8+=r.p8; totalSpread+=r.p8-r.p1;
      totalOvertakes+=r.overtakes; totalLeaderChanges+=r.leaderChanges;
      let raceCollisions=0;
      for(const x of r.racers){
        const a=agg[x.i];
        a.races++; a.wins+=x.rank===1?1:0; a.top3+=x.rank<=3?1:0;
        a.rankSum+=x.rank; a.timeSum+=x.time; a.best=Math.min(a.best,x.time); a.worst=Math.max(a.worst,x.time);
        a.collisions+=x.collisions; a.avoids+=x.avoids; a.overtakes+=x.overtakes;
        a.controls+=x.controls; a.controlOK+=x.controlOK; a.ratingSum+=x.rating;
        raceCollisions+=x.collisions;
      }
      const abilityOrder=players.map((p,i)=>({i,o:(p.stats.pace+p.stats.cornering+p.stats.insideLine+p.stats.routeReading+p.stats.avoidance+p.stats.control+p.stats.consistency+p.stats.focus)/8}))
        .sort((a,b)=>b.o-a.o);
      const winner=r.racers[0];
      const seed=abilityOrder.findIndex(q=>q.i===winner.i)+1;
      if(seed>=4){ upsetCount++; agg[winner.i].upsets++; }
      totalCollisions+=raceCollisions;
      if(raceCollisions===0) clean++;
    }
    const elapsed=performance.now()-started;
    const winRates=agg.map(a=>100*a.wins/count);
    const maxWin=Math.max(...winRates),minWin=Math.min(...winRates);
    const avgP1=totalP1/count,avgP8=totalP8/count,avgSpread=totalSpread/count;
    const warnings=[];
    if(maxWin>24) warnings.push(`특정 선수 우승률 과다 · 최고 ${maxWin.toFixed(1)}%`);
    if(maxWin-minWin>16) warnings.push(`선수 우승률 편차 큼 · ${ (maxWin-minWin).toFixed(1)}%p`);
    if(avgP1<45) warnings.push(`선두 평균 기록이 빠른 편 · ${avgP1.toFixed(1)}초`);
    if(avgP1>65) warnings.push(`선두 평균 기록이 느린 편 · ${avgP1.toFixed(1)}초`);
    if(totalCollisions/count<.5) warnings.push(`충돌 빈도가 낮음 · 경기당 ${(totalCollisions/count).toFixed(2)}회`);
    if(totalCollisions/count>3.5) warnings.push(`충돌 빈도가 높음 · 경기당 ${(totalCollisions/count).toFixed(2)}회`);
    if(totalOvertakes/count<6) warnings.push(`추월 빈도가 낮음 · 경기당 ${(totalOvertakes/count).toFixed(1)}회`);
    if(100*upsetCount/count<5) warnings.push(`이변 빈도가 낮음 · ${(100*upsetCount/count).toFixed(1)}%`);
    if(100*upsetCount/count>40) warnings.push(`이변 빈도가 높음 · ${(100*upsetCount/count).toFixed(1)}%`);

    return {count,elapsed,agg,avgP1,avgP8,avgSpread,
      avgCollisions:totalCollisions/count,cleanRate:100*clean/count,
      avgOvertakes:totalOvertakes/count,avgLeaderChanges:totalLeaderChanges/count,
      upsetRate:100*upsetCount/count,warnings};
  }

  function renderBalanceResult(result){
    const summary=document.getElementById("balanceSummary");
    const body=document.getElementById("balanceBody");
    const warnings=document.getElementById("balanceWarnings");
    if(!summary||!body||!warnings) return;

    summary.innerHTML=`
      <div><span>테스트 경기</span><b>${result.count.toLocaleString()}회</b></div>
      <div><span>계산 시간</span><b>${result.elapsed.toFixed(0)}ms</b></div>
      <div><span>평균 P1</span><b>${result.avgP1.toFixed(2)}s</b></div>
      <div><span>평균 P8</span><b>${result.avgP8.toFixed(2)}s</b></div>
      <div><span>P1-P8 격차</span><b>${result.avgSpread.toFixed(2)}s</b></div>
      <div><span>경기당 충돌</span><b>${result.avgCollisions.toFixed(2)}</b></div>
      <div><span>무충돌 경기</span><b>${result.cleanRate.toFixed(1)}%</b></div>
      <div><span>경기당 추월</span><b>${result.avgOvertakes.toFixed(1)}</b></div>
      <div><span>선두교체</span><b>${result.avgLeaderChanges.toFixed(1)}</b></div>
      <div><span>이변 발생률</span><b>${result.upsetRate.toFixed(1)}%</b></div>`;

    body.innerHTML=result.agg.map(a=>{
      const wr=100*a.wins/result.count,top3=100*a.top3/result.count;
      const cr=a.controls?100*a.controlOK/a.controls:0;
      return `<tr><td>${a.name}</td><td>${wr.toFixed(1)}%</td><td>${top3.toFixed(1)}%</td>
        <td>${(a.rankSum/a.races).toFixed(2)}</td><td>${(a.timeSum/a.races).toFixed(2)}s</td>
        <td>${a.best.toFixed(2)}s</td><td>${a.collisions}</td><td>${(a.overtakes/a.races).toFixed(1)}</td>
        <td>${cr.toFixed(1)}%</td><td>${(a.ratingSum/a.races).toFixed(2)}</td><td>${a.upsets}</td></tr>`;
    }).join("");

    warnings.innerHTML=result.warnings.length
      ? result.warnings.map(x=>`<div class="balance-warning">⚠ ${x}</div>`).join("")
      : `<div class="balance-ok">큰 자동 경고 없음 · 실제 경기 데이터와 함께 확인 권장</div>`;
  }

  function openBalanceTest(){
    const panel=document.getElementById("balancePanel");
    renderLiveBalance();
    if(panel) panel.classList.remove("hidden");
  }

  function formatTime(ms){
    if(ms==null || !isFinite(ms)) return "--";
    return `${(ms/1000).toFixed(3)}s`;
  }

  if(diagToggle && diagnostics){
    diagToggle.addEventListener("click",()=>{diagnostics.classList.toggle("hidden");renderDiagnostics();});
  }
  if(focusModeBtn){
    focusModeBtn.addEventListener("click",async()=>{
      const entering=!document.body.classList.contains("game-focus-mode");
      document.body.classList.toggle("game-focus-mode",entering);
      focusModeBtn.textContent=entering?"통계 화면으로":"게임 전체화면";
      if(entering && broadcastEl?.requestFullscreen){
        try{ await broadcastEl.requestFullscreen(); }catch(e){}
      }else if(!entering && document.fullscreenElement){
        try{ await document.exitFullscreen(); }catch(e){}
      }
    });
    document.addEventListener("fullscreenchange",()=>{
      if(!document.fullscreenElement && document.body.classList.contains("game-focus-mode")){
        document.body.classList.remove("game-focus-mode");
        focusModeBtn.textContent="게임 전체화면";
      }
    });
  }

  if(pauseBtn) pauseBtn.addEventListener("click",togglePause);
  startBtn.addEventListener("click",start);
  restartBtn.addEventListener("click",()=>{ reset(); start(); });
  document.getElementById("replayBtn").addEventListener("click",openReplay);
  document.getElementById("replayClose").addEventListener("click",()=>{
    replayPlaying=false;
    cancelAnimationFrame(replayRaf);
    document.getElementById("replayPanel").classList.add("hidden");
  });
  document.getElementById("replayPlay").addEventListener("click",e=>{
    replayPlaying=!replayPlaying;
    e.currentTarget.textContent=replayPlaying?"⏸ 정지":"▶ 재생";
    replayLastTs=0;
    if(replayPlaying) replayRaf=requestAnimationFrame(replayLoop);
  });
  document.getElementById("replaySlider").addEventListener("input",e=>{
    replayPlaying=false;
    document.getElementById("replayPlay").textContent="▶ 재생";
    setReplayCursor(Number(e.target.value));
  });
  document.querySelectorAll("[data-replay-speed]").forEach(b=>b.addEventListener("click",()=>{
    replaySpeed=1;
  }));
  document.getElementById("resultBtn").addEventListener("click",showMatchResults);
  document.getElementById("eloBtn").addEventListener("click",()=>{renderEloRanking();document.getElementById("eloPanel").classList.remove("hidden")});
  document.getElementById("eloClose").addEventListener("click",()=>document.getElementById("eloPanel").classList.add("hidden"));
  document.getElementById("balanceBtn").addEventListener("click",openBalanceTest);
  document.querySelectorAll("[data-balance-count]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const count=Number(btn.dataset.balanceCount)||100;
      btn.disabled=true;
      btn.textContent=`${count.toLocaleString()}회 계산 중…`;
      setTimeout(()=>{
        const result=runBalanceTest(count);
        renderBalanceResult(result);
        btn.disabled=false;
        btn.textContent=`${count.toLocaleString()}경기`;
      },30);
    });
  });
  document.getElementById("balanceClose").addEventListener("click",()=>document.getElementById("balancePanel").classList.add("hidden"));
  document.getElementById("liveBalanceReset").addEventListener("click",resetLiveBalance);
  document.getElementById("seasonResetBtn").addEventListener("click",resetSeason);
  document.getElementById("resultClose").addEventListener("click",()=>document.getElementById("resultPanel").classList.add("hidden"));
  document.getElementById("playerModalClose").addEventListener("click",()=>document.getElementById("playerModal").classList.add("hidden"));
  document.getElementById("playerModal").addEventListener("click",e=>{
    if(e.target.id==="playerModal") e.currentTarget.classList.add("hidden");
  });

  function v36SelfAudit(){
    const issues=[];
    if(names.length!==12||new Set(names).size!==12)issues.push("선수12");
    if(OBSERVER_COUNT!==100)issues.push("옵저버100");
    if(Math.abs(PLAYER_HIT_RADIUS-.56)>.0001)issues.push("HIT");
    // v4.08: generous outer survival buffer; no physical wall exists.
    if(Math.abs((1+.03)-1.03)>.0001)issues.push("가속도3");
    if(Math.abs(PLAYER_VISUAL_SCALE-.6583842)>.0001||Math.abs(OBS_VISUAL_SCALE-.851598)>.0001)issues.push("크기");
    if(STUN_MS!==0||INV_MS!==0)issues.push("즉사규칙");
    if(ROUND_POINTS.length!==12)issues.push("점수12");
    if(!["HongKey","TaeHyeon","DVA","LiveCam"].every(n=>names.includes(n)))issues.push("추가선수");
    if(!unitSprites[1]?.D||!unitSprites[5]?.D)issues.push("4팀스프라이트");
    return {ok:!issues.length,issues,build:BUILD_ID};
  }

  window.ObserverFMRaceEngine={
    version:BUILD_ID,selfAudit:v36SelfAudit,
    getPerformance:()=>({fps:diagFps,frameMs:diagFrameMs,maxFrameMs:diagMaxFrameMs,fpsProtectLevel}),
    schema:"observer-fm-race-result@1",
    getRules:()=>clonePlain(engineCoreRules()),
    getLastResult:()=>lastMasterResult?clonePlain(lastMasterResult):null,
    getCurrentState:()=>({build:BUILD_ID,running,paused,currentRound,simClock,
      teamScores:{A:teamTotals.A,B:teamTotals.B,C:teamTotals.C,D:teamTotals.D},finished:players.filter(p=>p.done).length}),
    startCurrent:start,resetMatch:reset
  };

  map.addEventListener("load",reset);
  if(map.complete) reset();
})();
