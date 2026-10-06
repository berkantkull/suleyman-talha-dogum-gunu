const $ = (selector) => document.querySelector(selector);
const startScreen = $('#startScreen');
const cakeStage = $('#cakeStage');
const blowButton = $('#blowButton');
const holdButton = $('#holdButton');
const wishPanel = $('#wishPanel');
const message = $('#message');
const micPanel = $('#micPanel');
const micStatus = $('#micStatus');
const meterFill = $('#meterFill');
const soundToggle = $('#soundToggle');
const confettiCanvas = $('#confetti');
const ctx = confettiCanvas.getContext('2d');

let audioContext;
let musicTimer;
let musicOn = true;
let celebrated = false;
let micStream;
let analyserFrame;
let holdTimer;

const melody = [
  ['G4',.22],['G4',.22],['A4',.45],['G4',.45],['C5',.45],['B4',.8],
  ['G4',.22],['G4',.22],['A4',.45],['G4',.45],['D5',.45],['C5',.8],
  ['G4',.22],['G4',.22],['G5',.45],['E5',.45],['C5',.45],['B4',.45],['A4',.8],
  ['F5',.22],['F5',.22],['E5',.45],['C5',.45],['D5',.45],['C5',.9]
];
const frequencies = {G4:392,A4:440,B4:493.88,C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99};

function ensureAudio(){
  if(!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if(audioContext.state === 'suspended') audioContext.resume();
}

function playTone(frequency, duration, at){
  if(!musicOn || !audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'square';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(.055, at);
  gain.gain.exponentialRampToValueAtTime(.001, at + Math.max(.08,duration));
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

function playMelody(){
  if(!musicOn) return;
  ensureAudio();
  let cursor = audioContext.currentTime + .05;
  melody.forEach(([note,duration]) => { playTone(frequencies[note], duration*.82, cursor); cursor += duration; });
  clearTimeout(musicTimer);
  musicTimer = setTimeout(playMelody, (cursor-audioContext.currentTime+1.2)*1000);
}

function stopMusic(){ clearTimeout(musicTimer); musicTimer = null; }

$('#startButton').addEventListener('click', () => {
  ensureAudio();
  playMelody();
  document.body.classList.remove('start-locked');
  window.scrollTo(0,0);
  startScreen.classList.add('hidden');
  setTimeout(() => startScreen.remove(), 500);
});

soundToggle.addEventListener('click', () => {
  musicOn = !musicOn;
  soundToggle.setAttribute('aria-pressed', String(musicOn));
  soundToggle.textContent = musicOn ? '♫ AÇIK' : '♫ KAPALI';
  soundToggle.setAttribute('aria-label', musicOn ? 'Müziği kapat' : 'Müziği aç');
  musicOn ? playMelody() : stopMusic();
});

async function listenForBlow(){
  if(celebrated) return;
  try{
    ensureAudio();
    micStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    micPanel.hidden = false;
    blowButton.disabled = true;
    blowButton.textContent = 'DİNLİYORUM…';
    const source = audioContext.createMediaStreamSource(micStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let strongFrames = 0;
    const sample = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for(const value of data){ const normalized = (value-128)/128; sum += normalized*normalized; }
      const level = Math.sqrt(sum/data.length);
      meterFill.style.width = `${Math.min(100,Math.max(4,level*430))}%`;
      strongFrames = level > .12 ? strongFrames + 1 : Math.max(0,strongFrames-1);
      if(strongFrames > 5){ celebrate(); return; }
      analyserFrame = requestAnimationFrame(sample);
    };
    sample();
  }catch(error){
    micPanel.hidden = false;
    micStatus.textContent = 'Mikrofon açılamadı. Aşağıdaki düğmeye basılı tutabilirsin.';
    blowButton.disabled = false;
    blowButton.textContent = 'MİKROFONU TEKRAR DENE';
  }
}

blowButton.addEventListener('click', listenForBlow);

function startHold(event){
  event.preventDefault();
  if(celebrated) return;
  holdButton.classList.add('holding');
  holdTimer = setTimeout(celebrate, 1250);
}
function cancelHold(){ clearTimeout(holdTimer); holdButton.classList.remove('holding'); }
['pointerdown','keydown'].forEach(type => holdButton.addEventListener(type, event => {
  if(type === 'keydown' && ![' ','Enter'].includes(event.key)) return;
  startHold(event);
}));
['pointerup','pointerleave','pointercancel','keyup'].forEach(type => holdButton.addEventListener(type, cancelHold));

function celebrate(){
  if(celebrated) return;
  celebrated = true;
  cancelHold();
  cancelAnimationFrame(analyserFrame);
  micStream?.getTracks().forEach(track => track.stop());
  cakeStage.classList.add('blown');
  wishPanel.hidden = true;
  $('#instruction').textContent = 'Dileğin kabul olsun!';
  setTimeout(() => { message.hidden = false; message.scrollIntoView({behavior:'smooth',block:'center'}); }, 420);
  launchConfetti();
  launchBalloons();
  victoryChime();
}

function victoryChime(){
  ensureAudio();
  const now = audioContext.currentTime;
  ['C5','E5','G5','C5'].forEach((note,index) => playTone(frequencies[note],.2,now+index*.09));
}

$('#againButton').addEventListener('click', () => {
  celebrated = false;
  cakeStage.classList.remove('blown');
  message.hidden = true;
  wishPanel.hidden = false;
  micPanel.hidden = true;
  blowButton.disabled = false;
  blowButton.innerHTML = '<span>◉</span> MİKROFONA ÜFLE';
  $('#instruction').textContent = 'Bir dilek daha tut. Hazır olunca mumlara üfle.';
  window.scrollTo({top:0,behavior:'smooth'});
});

const confetti = [];
function sizeCanvas(){ const ratio = Math.min(2,window.devicePixelRatio||1); confettiCanvas.width=innerWidth*ratio; confettiCanvas.height=innerHeight*ratio; ctx.setTransform(ratio,0,0,ratio,0,0); }
addEventListener('resize',sizeCanvas); sizeCanvas();

function launchConfetti(){
  const colors=['#ff4f9a','#ffd65a','#5ce1e6','#ffffff','#8f79ff'];
  for(let i=0;i<220;i++) confetti.push({x:innerWidth/2+(Math.random()-.5)*180,y:innerHeight*.42,vx:(Math.random()-.5)*16,vy:-Math.random()*13-5,g:.22+Math.random()*.11,r:3+Math.random()*5,color:colors[i%colors.length],spin:Math.random()*6});
  animateConfetti();
}
function animateConfetti(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  for(let i=confetti.length-1;i>=0;i--){
    const p=confetti[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=p.g; p.spin+=.18;
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.spin); ctx.fillStyle=p.color; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.7); ctx.restore();
    if(p.y>innerHeight+30) confetti.splice(i,1);
  }
  if(confetti.length) requestAnimationFrame(animateConfetti); else ctx.clearRect(0,0,innerWidth,innerHeight);
}

function launchBalloons(){
  const holder=$('#balloons');
  holder.setAttribute('aria-hidden','false');
  for(let i=0;i<14;i++){
    const balloon=document.createElement('button');
    balloon.className='balloon'; balloon.type='button'; balloon.textContent='🎈'; balloon.setAttribute('aria-label','Balonu patlat');
    balloon.style.left=`${Math.random()*92}%`; balloon.style.setProperty('--duration',`${5+Math.random()*4}s`); balloon.style.setProperty('--drift',`${(Math.random()-.5)*180}px`); balloon.style.setProperty('--turn',`${(Math.random()-.5)*50}deg`); balloon.style.animationDelay=`${Math.random()*1.8}s`;
    balloon.addEventListener('click',()=>{ balloon.classList.add('pop'); setTimeout(()=>balloon.remove(),280); popSound(); });
    balloon.addEventListener('animationend',()=>balloon.remove()); holder.appendChild(balloon);
  }
}
function popSound(){ ensureAudio(); const osc=audioContext.createOscillator(); const gain=audioContext.createGain(); osc.type='square'; osc.frequency.setValueAtTime(180,audioContext.currentTime); osc.frequency.exponentialRampToValueAtTime(55,audioContext.currentTime+.09); gain.gain.setValueAtTime(.045,audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.1); osc.connect(gain).connect(audioContext.destination); osc.start(); osc.stop(audioContext.currentTime+.11); }
