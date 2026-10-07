// Fit the complete active screen, including feedback and actions, inside the
// visible browser area. visualViewport also accounts for the mobile keyboard.
(()=>{
 const root=document.documentElement,app=document.getElementById('app');
 let frame=0,observed=null;
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)}
 const observer=new ResizeObserver(schedule);
 observer.observe(app);
 function fit(){
  const viewport=window.visualViewport;
  root.style.setProperty('--visible-height',(viewport?viewport.height:innerHeight)+'px');
  root.classList.toggle('keyboard-open',!!viewport&&viewport.height<innerHeight*.75);
  const section=app.firstElementChild;if(!section)return;
  if(observed!==section){if(observed)observer.unobserve(observed);observed=section;observer.observe(section)}
  const scale=Math.min(1,app.clientHeight/Math.max(1,section.offsetHeight),app.clientWidth/Math.max(1,section.scrollWidth));
  section.style.transform=`scale(${scale})`;
 }
 new MutationObserver(schedule).observe(app,{childList:true,subtree:true,characterData:true});
 addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 document.fonts?.ready.then(schedule);
 schedule();
})();
