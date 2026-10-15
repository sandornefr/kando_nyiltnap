/* The local sample website shared by the teacher and every student. */
(() => {
  'use strict';
  const copy={
    title:{discover:'Kutyakozmetika, odafigyeléssel.',build:'Ápolt bunda, jó közérzet.',future:'Szőrápolás, nyugodt környezetben.'},
    intro:{curious:'Fürdetés és teljes kozmetika, előre egyeztetett időpontban.',team:'Kistestű és nagytestű kutyákat is várunk.',practice:'Válassz szolgáltatást, és kérj időpontot online.'},
    cardCode:{create:'Fürdetés, szárítás, átfésülés.',solve:'Tiszta, könnyen fésülhető bunda.',play:'Kímélő ápolás minden szőrtípushoz.'},
    cardNetwork:{connect:'Fürdetés, nyírás, karomápolás.',explore:'Teljes ápolás az orrtól a farokig.',signal:'Fazonigazítás és alapos szőrápolás.'},
    buttonLabel:{try:'Időpontot kérek',join:'Időpontkérés',discover:'Kérek egy időpontot'},
    footerText:{community:'Szeretettel várunk a Tücsökben.',future:'Bejelentkezés előzetes egyeztetéssel.',welcome:'Bejelentkezés alapján'}
  };
  const defaults={theme:'violet',title:'discover',intro:'curious',hero:'code',cardCode:'create',cardNetwork:'connect',buttonLabel:'try',layout:'cards',buttonTarget:'signup',formRule:'nonempty',navTarget:'programs',feedback:'visible',menuRule:'toggle',counterRule:'one',filterRule:'match',headingSize:'large',borderStyle:'soft',footerText:'community'};
  const palettes={violet:{accent:'#6e5470',soft:'#f0eaf0'},mint:{accent:'#42634b',soft:'#eaf0e8'},amber:{accent:'#a55231',soft:'#f6ebe4'}};
  const business={name:'Tücsök Kutyakozmetika',address:'1172 Budapest, Újlak u. 17–21.',phone:'+36 20 425 5441',hours:'Bejelentkezés alapján',source:'https://www.facebook.com/tucsokkutyakozmetika/about'};
  const photos={code:{src:'assets/grooming.jpg',alt:'Kutya szőrének ápolása – stockfotó, illusztráció'},network:{src:'assets/bath.jpg',alt:'Kutyafürdetés – stockfotó, illusztráció'},team:{src:'assets/dog.jpg',alt:'Ápolt kutya portréja – stockfotó, illusztráció'}};
  const demoTimes=['09:00','10:30','13:00','14:30'],demoNames=['Bodri','Masni','Morzsi','Zokni','Pötyi','Buksi'];
  const safe=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const text=(c,key)=>safe(copy[key][c[key]]||copy[key][defaults[key]]);
  const configOf=config=>({...defaults,...config});
  const themeOf=c=>Object.hasOwn(palettes,c.theme)?c.theme:'violet';
  // Missing build information means the complete example (legacy callers).
  // An explicit empty list means a genuinely empty website, not DEFAULTS.
  const buildOf=options=>Array.isArray(options?.builtKeys)?new Set(options.builtKeys):null;
  const built=(build,key)=>build===null||build.has(key);
  const anyBuilt=(build,...keys)=>keys.some(key=>built(build,key));
  const viewForKey=key=>['cardCode','cardNetwork','layout','filterRule'].includes(key)?'programs':['formRule','feedback','counterRule'].includes(key)?'signup':'home';
  const emptyPage=()=>'<div class="ks-empty" role="status"><span>Ez az oldal még üres.</span></div>';
  const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
  // These same helpers supply the source shown in the lesson's final explanation.
  function mainButton(c){
    return `<button type="button"\n  class="ks-primary"\n  data-action="hero">\n  ${text(c,'buttonLabel')}\n</button>`;
  }
  function accentRules(theme){
    const p=palettes[theme];
    return `.ks-site.ks-theme-${theme} {\n  --ks-accent: ${p.accent};\n  --ks-accent-soft: ${p.soft};\n}`;
  }
  const buttonColorRule='.ks-site .ks-primary {\n  background: var(--ks-accent);\n  color: #fff;\n}';
  function routeMainButton(target, go) {
    const view = target === 'programs'
      ? 'programs' : 'signup';
    go(view);
    return view;
  }
  const css=`
  ${Object.keys(palettes).map(accentRules).join('\n')}
  .ks-site{--ks-radius:10px;position:relative;isolation:isolate;container-name:ks-site;container-type:size;display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:#f7f4ed;color:#2d302b;font:14px/1.35 Arial,'Segoe UI',sans-serif;text-align:left;letter-spacing:0;color-scheme:light}.ks-site *{box-sizing:border-box}.ks-site [hidden]{display:none!important}.ks-site :is(h2,h3,h4,p){margin:0;color:inherit;letter-spacing:inherit}.ks-site :is(button,input,a){font:inherit;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.ks-site button{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:44px;min-height:44px;padding:10px 14px;border:1px solid transparent;border-radius:var(--ks-radius);background:transparent;color:inherit;font-weight:700;line-height:1.2;white-space:normal;cursor:pointer;box-shadow:none;text-transform:none;margin:0}.ks-site button:hover:not(:disabled){background:var(--ks-accent-soft)}.ks-site button:disabled{cursor:default}.ks-site a{color:inherit;text-decoration:none}.ks-site :is(button,a,input):focus-visible{outline:3px solid var(--ks-accent);outline-offset:2px}.ks-site svg{display:block;flex:none;width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.ks-site img{display:block;max-width:100%;object-fit:cover}.ks-site.ks-square{--ks-radius:0}
  ${buttonColorRule}
  .ks-site .ks-primary:hover:not(:disabled){background:var(--ks-accent);filter:brightness(.9);color:#fff}.ks-site .ks-header{display:flex;align-items:center;gap:16px;flex:none;min-height:62px;padding:7px 24px;background:#fbfaf6;border-bottom:1px solid #deded3;position:relative;z-index:3}.ks-site .ks-brand{display:flex;align-items:baseline;gap:8px;min-height:44px;flex:none;align-content:center;flex-wrap:wrap}.ks-site .ks-brand-name{align-self:center;font:700 29px/1 Georgia,'Times New Roman',serif;letter-spacing:-.035em;color:#394a3b}.ks-site .ks-brand-description{align-self:center;color:#65685f;font-size:14px}.ks-site .ks-nav{display:flex;gap:4px;margin-left:auto}.ks-site .ks-nav a,.ks-site .ks-menu a{display:flex;align-items:center;min-height:44px;padding:10px;font-weight:700}.ks-site .ks-nav a:hover{color:var(--ks-accent)}.ks-site .ks-menu-toggle{margin-left:auto;flex:none;padding:9px}.ks-site .ks-nav+.ks-menu-toggle{margin-left:0}.ks-site .ks-menu{position:absolute;z-index:8;top:56px;right:12px;min-width:225px;padding:6px;background:#fffefb;border:1px solid #d9d9ce;border-radius:var(--ks-radius);box-shadow:0 12px 30px #292b271b}.ks-site .ks-menu a:hover{background:var(--ks-accent-soft)}
  .ks-site .ks-stage{display:flex;flex-direction:column;flex:1;min-height:0;padding:16px 20px;overflow:hidden}.ks-site .ks-home{display:flex;flex-direction:column;flex:1;min-height:0;gap:12px}.ks-site .ks-hero{position:relative;display:flex;align-items:center;flex:1;min-height:0;overflow:hidden;border-radius:var(--ks-radius);background:#ede9df}.ks-site .ks-hero-media{position:absolute;inset:0 0 0 37%;overflow:hidden}.ks-site .ks-hero-image{width:100%;height:100%;object-fit:cover;object-position:60% 40%}.ks-site .ks-photo-network{object-position:65% 50%}.ks-site .ks-photo-team{object-position:48% 35%}.ks-site .ks-hero:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,#eeeae0 0%,#eeeae0 39%,#eeeae0ed 45%,#eeeae000 68%);pointer-events:none}.ks-site .ks-hero-copy{position:relative;z-index:1;padding:25px;max-width:57%;min-width:0}.ks-site .ks-eyebrow{font-size:14px;font-weight:700;color:#596652;margin-bottom:10px}.ks-site .ks-title{font:400 clamp(30px,4.6cqw,53px)/1.04 Georgia,'Times New Roman',serif;letter-spacing:-.035em;margin-bottom:13px;text-wrap:balance;overflow-wrap:normal}.ks-site.ks-heading-normal .ks-title{font-size:clamp(27px,3.6cqw,39px)}.ks-site .ks-intro{font-size:14px;line-height:1.45;color:#545b50;margin-bottom:18px;max-width:340px}.ks-site .ks-hero-actions{display:flex;align-items:center;gap:9px}.ks-site .ks-photo-credit{position:absolute;z-index:2;right:9px;bottom:8px;font-size:14px;padding:3px 6px;background:#f7f4ede6;color:#495044;border-radius:4px}.ks-site .ks-contact-strip{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;color:#555d50}.ks-site .ks-contact-strip strong{font-weight:700}.ks-site .ks-contact-strip a{margin-left:auto;text-decoration:underline;text-underline-offset:3px}
  .ks-site .ks-mini-programs{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:none}.ks-site .ks-mini-card{display:grid;grid-template-columns:78px minmax(0,1fr) 20px;gap:13px;width:100%;padding:0 15px 0 0;min-height:84px;overflow:hidden;background:#fffef9;border:1px solid #deded2;border-radius:var(--ks-radius);text-align:left}.ks-site .ks-mini-photo{width:78px;height:100%;min-height:82px;object-fit:cover;object-position:60% 40%}.ks-site .ks-mini-card strong{display:block;font-size:18px;line-height:1.15}.ks-site .ks-mini-card small{display:block;margin-top:5px;font-size:14px;line-height:1.3;font-weight:400;color:#60665a}.ks-site.ks-layout-split .ks-mini-programs{grid-template-columns:1fr;gap:0}.ks-site.ks-layout-split .ks-mini-card{min-height:48px;grid-template-columns:48px minmax(0,1fr) 20px;border-radius:0}.ks-site.ks-layout-split .ks-mini-photo{width:48px;min-height:46px;height:46px}.ks-site.ks-layout-split .ks-mini-card:first-child{border-bottom:0}.ks-site.ks-layout-split .ks-mini-card>span{display:flex;align-items:center;justify-content:space-between;gap:12px}.ks-site.ks-layout-split .ks-mini-card small{margin:0}.ks-site .ks-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;padding:7px 20px;border-top:1px solid #deded3;min-height:33px;color:#62685c;font-size:14px}.ks-site .ks-footer span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.ks-site .ks-footer a{flex:none;color:var(--ks-accent);text-decoration:underline;text-underline-offset:3px}
  .ks-site .ks-page{display:flex;flex-direction:column;flex:1;min-height:0;gap:12px}.ks-site .ks-page-top{display:flex;align-items:center;gap:11px;flex:none;min-height:44px}.ks-site .ks-back{padding:10px;border:1px solid #d6d9cd;background:#fffef9;flex:none}.ks-site .ks-back svg{transform:rotate(180deg)}.ks-site .ks-page-top h3{font:400 29px/1.1 Georgia,'Times New Roman',serif}.ks-site .ks-page-top p{font-size:14px;line-height:1.25;color:#60665a;margin-top:4px}.ks-site .ks-filters{display:flex;gap:6px;flex:none}.ks-site .ks-filter{padding:8px 12px;border:1px solid #d6d9cd;background:#fffef9}.ks-site .ks-filter[aria-pressed=true]{background:var(--ks-accent-soft);border-color:var(--ks-accent);color:var(--ks-accent)}.ks-site .ks-filter-count{margin-left:auto;align-self:center;color:#60665a;white-space:nowrap;font-size:14px}.ks-site .ks-program-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;flex:1;min-height:0}.ks-site .ks-program-card{display:grid;grid-template-columns:39% minmax(0,1fr);grid-template-rows:auto 1fr auto;gap:10px 15px;min-height:0;overflow:hidden;padding:0 14px 14px 0;border:1px solid #deded3;border-radius:var(--ks-radius);background:#fffef9}.ks-site .ks-service-photo{grid-column:1;grid-row:1/4;width:100%;height:100%;min-height:0;object-fit:cover;object-position:60% 40%}.ks-site .ks-program-card h4{grid-column:2;font:400 26px/1.08 Georgia,'Times New Roman',serif;padding-top:16px}.ks-site .ks-program-card p{grid-column:2;color:#60665a;font-size:14px;line-height:1.35}.ks-site .ks-program-card button{grid-column:2;align-self:end;justify-self:start;background:var(--ks-accent-soft);color:var(--ks-accent);flex-shrink:0;max-width:100%}.ks-site .ks-program-action-short{display:none}.ks-site.ks-layout-split .ks-program-grid{grid-template-columns:1fr;gap:0}.ks-site.ks-layout-split .ks-program-card{grid-template-columns:80px minmax(0,1fr) auto;grid-template-rows:auto auto;border-radius:0;padding:0 12px 0 0;gap:4px 12px;align-content:center}.ks-site.ks-layout-split .ks-program-card:first-child{border-bottom:0}.ks-site.ks-layout-split .ks-service-photo{grid-row:1/3}.ks-site.ks-layout-split .ks-program-card h4{padding:8px 0 0}.ks-site.ks-layout-split .ks-program-card p{padding-bottom:8px}.ks-site.ks-layout-split .ks-program-card button{grid-column:3;grid-row:1/3;align-self:center}
  .ks-site[data-view=signup] .ks-footer{display:none}.ks-site .ks-booking-page{gap:12px}.ks-site .ks-booking-head h3{font-size:26px}.ks-site .ks-booking-head p{display:block!important}.ks-site .ks-booking-layout{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:20px;flex:1;min-height:0}.ks-site .ks-booking-photo{position:relative;min-height:0;overflow:hidden;border-radius:var(--ks-radius);background:#ddd7ca}.ks-site .ks-booking-photo img{width:100%;height:100%;object-position:48% 35%}.ks-site .ks-booking-photo span{position:absolute;left:12px;bottom:12px;right:12px;padding:9px;background:#f7f4edeb;color:#344231;font-size:14px}.ks-site .ks-calendar-main{display:flex;flex-direction:column;gap:12px;min-height:0}.ks-site .ks-day-nav{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:8px;align-items:center;flex:none}.ks-site .ks-day-nav button{padding:8px;border:1px solid #d6d9cd;background:#fffef9}.ks-site .ks-day-nav button:disabled{opacity:.35}.ks-site .ks-day-label{text-align:center;min-width:0}.ks-site .ks-day-label strong{display:block;font-size:17px;line-height:1.15}.ks-site .ks-day-label span{display:block;font-size:14px;color:#67705f;margin-top:3px}.ks-site .ks-slots{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px;flex:1;min-height:0}.ks-site .ks-slot{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:5px;min-height:64px;padding:13px 17px;border:1px solid #adc2a4;border-radius:var(--ks-radius);background:#edf4e7;color:#38512f;text-align:left}.ks-site .ks-slot strong{font-size:24px;line-height:1.1}.ks-site .ks-slot span{font-size:14px;line-height:1.2;font-weight:400}.ks-site .ks-slot:hover:not(:disabled){background:#dfebd7;border-color:#66835a}.ks-site .ks-slot:disabled{border-color:#e0ddd3;background:#eeece5;color:#72766c}.ks-site .ks-slot:disabled strong{text-decoration:line-through;text-decoration-thickness:1px;color:#777d71}.ks-site .ks-calendar-note{font-size:14px;line-height:1.2;color:#67705f}.ks-site .ks-form-layout{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:24px;flex:1;min-height:0;align-items:center}.ks-site .ks-form-aside{display:flex;flex-direction:column;gap:12px;min-height:0;align-self:stretch;justify-content:center}.ks-site .ks-form-aside img{width:100%;height:clamp(90px,28cqh,200px);object-fit:cover;object-position:48% 35%;border-radius:var(--ks-radius)}.ks-site .ks-form-aside h4{font:400 26px/1.1 Georgia,'Times New Roman',serif}.ks-site .ks-form-aside p{font-size:14px;color:#60665a}.ks-site .ks-form{display:flex;flex-direction:column;gap:10px;min-width:0;margin:0}.ks-site .ks-field-label{display:block;font-size:14px;font-weight:700;margin-bottom:5px;white-space:nowrap}.ks-site .ks-name{display:block;width:100%;height:44px;border:1px solid #aebaa4;border-radius:var(--ks-radius);padding:10px 12px;background:#fffef9;color:#2d302b;font-size:16px;min-width:0}.ks-site .ks-name[aria-invalid=true]{border-color:#aa4435}.ks-site .ks-local-note{font-size:14px;line-height:1.25;color:#626a5b}.ks-site .ks-count-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.ks-site .ks-count-label{font-size:14px;font-weight:700}.ks-site .ks-stepper{display:flex;align-items:center;border:1px solid #b4c0aa;border-radius:var(--ks-radius);background:#fffef9;overflow:hidden;flex:none}.ks-site .ks-stepper button{padding:8px;font-size:20px;border-radius:0}.ks-site .ks-stepper button:disabled{opacity:.35}.ks-site .ks-stepper output{min-width:26px;font-size:17px;text-align:center;font-weight:700}.ks-site .ks-form .ks-primary{width:100%}.ks-site .ks-status{font-size:14px;line-height:1.2;color:#a03d30}.ks-site .ks-status:empty{display:none}.ks-site .ks-success{display:flex;flex-direction:column;align-items:center;gap:14px;max-width:440px;margin:auto;text-align:center}.ks-site .ks-success h3{font:400 34px/1.1 Georgia,'Times New Roman',serif}.ks-site .ks-success p,.ks-site .ks-success small{font-size:14px;line-height:1.35;color:#626a5b;overflow-wrap:anywhere}.ks-site .ks-success-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;border:1px solid var(--ks-accent);color:var(--ks-accent);font-size:27px}.ks-site .ks-success-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:7px}.ks-site .ks-success-actions button{border:1px solid #cad3c1}
  .ks-site .ks-contact-page{gap:14px}.ks-site .ks-contact-content{display:grid;grid-template-columns:1fr 1fr;gap:18px;flex:1;min-height:0;align-content:center}.ks-site .ks-contact-block{padding:16px;border-top:1px solid #d4dacb}.ks-site .ks-contact-block h4{font-size:14px;color:#606a57;margin-bottom:7px}.ks-site .ks-contact-block p,.ks-site .ks-contact-block a{font-size:18px;line-height:1.3}.ks-site .ks-contact-block a{color:var(--ks-accent);text-decoration:underline;text-underline-offset:3px}.ks-site .ks-contact-small{font-size:14px!important;line-height:1.3!important;color:#646d5c}.ks-site .ks-contact-source{font-size:14px;line-height:1.3;color:#646d5c}.ks-site .ks-contact-source a{text-decoration:underline;text-underline-offset:3px}.ks-site .ks-credits{display:flex;flex-direction:column;justify-content:center;gap:14px;flex:1;min-height:0;max-width:620px;font-size:14px;line-height:1.4}.ks-site .ks-credits a{text-decoration:underline;text-underline-offset:3px;color:var(--ks-accent)}
  .ks-site.ks-compact .ks-nav{display:none}.ks-site.ks-compact .ks-menu-toggle{margin-left:auto}.ks-site.ks-compact .ks-booking-layout,.ks-site.ks-compact .ks-form-layout{grid-template-columns:1fr}.ks-site.ks-compact .ks-booking-photo,.ks-site.ks-compact .ks-form-aside{display:none}.ks-site.ks-compact .ks-filter-count{display:none}
  @container ks-site (max-width:700px){.ks-site .ks-header{padding:3px 12px;min-height:52px;gap:8px}.ks-site .ks-brand-name{font-size:27px}.ks-site .ks-nav{display:none}.ks-site .ks-menu-toggle{margin-left:auto!important}.ks-site .ks-menu{top:48px}.ks-site .ks-stage{padding:12px}.ks-site .ks-hero-media{left:0}.ks-site .ks-hero:after{background:linear-gradient(90deg,#eeeae0f2 0%,#eeeae0e8 30%,#eeeae09c 53%,#eeeae000 85%)}.ks-site .ks-hero-copy{padding:18px;max-width:70%}.ks-site .ks-title{font-size:34px}.ks-site.ks-heading-normal .ks-title{font-size:28px}.ks-site .ks-intro{display:none}.ks-site .ks-contact-strip{display:none}.ks-site .ks-mini-card{grid-template-columns:52px minmax(0,1fr);gap:9px;padding-right:9px;min-height:66px}.ks-site .ks-mini-photo{width:52px;min-height:64px}.ks-site .ks-mini-card>svg,.ks-site .ks-mini-card small{display:none}.ks-site .ks-mini-card strong{font-size:16px}.ks-site .ks-program-grid{grid-template-columns:1fr}.ks-site .ks-program-card,.ks-site.ks-layout-split .ks-program-card{grid-template-columns:78px minmax(0,1fr) auto;grid-template-rows:auto auto;padding:0 10px 0 0;gap:4px 11px;align-content:center}.ks-site .ks-service-photo{grid-row:1/3}.ks-site .ks-program-card h4{padding:7px 0 0;font-size:22px}.ks-site .ks-program-card p{padding-bottom:7px}.ks-site .ks-program-card button{grid-column:3;grid-row:1/3;align-self:center;max-width:94px;padding:8px}.ks-site .ks-program-action-text{display:none}.ks-site .ks-program-action-short{display:inline}.ks-site .ks-filter-count{display:none}.ks-site .ks-booking-layout,.ks-site .ks-form-layout{grid-template-columns:1fr}.ks-site .ks-booking-photo,.ks-site .ks-form-aside{display:none}.ks-site .ks-footer{padding:6px 12px}.ks-site .ks-footer a{font-size:14px}.ks-site .ks-contact-content{gap:8px}.ks-site .ks-contact-block{padding:10px}.ks-site .ks-contact-block p,.ks-site .ks-contact-block a{font-size:16px}}
  @container ks-site (max-width:420px){.ks-site .ks-header{gap:6px}.ks-site .ks-brand{gap:7px}.ks-site .ks-brand-name{font-size:26px}.ks-site .ks-brand-description{font-size:14px}.ks-site .ks-home{gap:8px}.ks-site .ks-hero-copy{max-width:77%;padding:13px}.ks-site .ks-title{font-size:29px}.ks-site.ks-heading-normal .ks-title{font-size:25px}.ks-site .ks-eyebrow{margin-bottom:8px}.ks-site .ks-photo-credit{right:5px;bottom:5px;font-size:14px}.ks-site .ks-mini-card{grid-template-columns:44px minmax(0,1fr);gap:7px;min-height:58px}.ks-site .ks-mini-photo{width:44px;min-height:56px}.ks-site .ks-mini-card strong{font-size:14px}.ks-site .ks-mini-programs{gap:8px}.ks-site .ks-page-top h3{font-size:24px}.ks-site .ks-page-top:not(.ks-booking-head) p{display:none}.ks-site .ks-filter{padding:8px 10px}.ks-site .ks-program-card,.ks-site.ks-layout-split .ks-program-card{grid-template-columns:52px minmax(0,1fr) auto;gap:4px 8px;padding-right:7px}.ks-site .ks-program-card h4{font-size:19px}.ks-site .ks-program-card button{max-width:81px;padding:8px 6px}.ks-site .ks-program-card button svg{display:none}.ks-site .ks-booking-head h3{font-size:22px}.ks-site .ks-booking-head p{font-size:14px}.ks-site .ks-day-label strong{font-size:16px}.ks-site .ks-slot{padding:10px 12px}.ks-site .ks-slot strong{font-size:21px}.ks-site .ks-contact-content{grid-template-columns:1fr;gap:3px}.ks-site .ks-contact-block{padding:8px 0}.ks-site .ks-contact-block h4{margin-bottom:3px}.ks-site .ks-contact-source{font-size:14px}.ks-site .ks-success h3{font-size:28px}}
  @container ks-site (max-height:430px){.ks-site .ks-header{min-height:48px;padding-top:2px;padding-bottom:2px}.ks-site .ks-menu{top:44px}.ks-site .ks-stage{padding:10px 12px}.ks-site .ks-home{gap:8px}.ks-site .ks-hero-copy{padding:15px}.ks-site .ks-title{font-size:30px;margin-bottom:10px}.ks-site.ks-heading-normal .ks-title{font-size:25px}.ks-site .ks-intro{display:none}.ks-site .ks-eyebrow{margin-bottom:7px}.ks-site .ks-mini-card{min-height:58px}.ks-site .ks-mini-photo{min-height:56px}.ks-site .ks-mini-card small,.ks-site .ks-contact-strip{display:none}.ks-site .ks-page{gap:8px}.ks-site .ks-page-top:not(.ks-booking-head) p{display:none}.ks-site .ks-page-top h3{font-size:24px}.ks-site .ks-program-card h4{font-size:22px}.ks-site .ks-program-card p{display:none}.ks-site .ks-program-card{grid-template-rows:1fr auto}.ks-site .ks-service-photo{grid-row:1/3}.ks-site .ks-booking-head h3{font-size:23px}.ks-site .ks-calendar-main{gap:8px}.ks-site .ks-slots{gap:8px}.ks-site .ks-slot{min-height:52px;padding:8px 12px;gap:3px}.ks-site .ks-slot strong{font-size:21px}.ks-site .ks-calendar-note{display:none}.ks-site .ks-form{gap:7px}.ks-site .ks-form-aside img{height:110px}.ks-site .ks-success{gap:9px}.ks-site .ks-success h3{font-size:28px}.ks-site .ks-success-icon{width:38px;height:38px;font-size:23px}.ks-site .ks-footer{min-height:29px;padding-top:5px;padding-bottom:5px}.ks-site .ks-contact-block{padding:7px 10px}.ks-site .ks-contact-content{gap:5px}}
  @container ks-site (max-height:360px){.ks-site .ks-footer{display:none}.ks-site .ks-stage{padding:7px 10px}.ks-site .ks-title{font-size:26px;margin-bottom:9px}.ks-site.ks-heading-normal .ks-title{font-size:23px}.ks-site .ks-hero-copy{padding:12px;max-width:69%}.ks-site .ks-eyebrow{display:none}.ks-site .ks-mini-card{min-height:54px}.ks-site .ks-mini-photo{min-height:52px}.ks-site .ks-mini-card strong{font-size:14px}.ks-site .ks-page{gap:6px}.ks-site .ks-page-top h3{font-size:22px}.ks-site .ks-booking-head{min-height:44px}.ks-site .ks-booking-head h3{font-size:21px}.ks-site .ks-booking-head p{margin-top:3px;line-height:1.15}.ks-site .ks-calendar-main{gap:6px}.ks-site .ks-slots{gap:6px;grid-template-rows:1fr 1fr}.ks-site .ks-slot{min-height:48px;padding:6px 10px;gap:2px}.ks-site .ks-slot strong{font-size:18px}.ks-site .ks-slot span{font-size:14px}.ks-site .ks-day-label strong{font-size:16px}.ks-site .ks-day-label span{margin-top:2px}.ks-site .ks-form,.ks-site.ks-compact .ks-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:end}.ks-site .ks-form>div:first-child{grid-column:1;grid-row:1}.ks-site .ks-count-row{grid-column:2;grid-row:1;display:block}.ks-site .ks-count-label{display:block;margin-bottom:5px}.ks-site .ks-local-note{grid-column:1/-1;grid-row:2}.ks-site .ks-form .ks-primary{grid-column:1/-1;grid-row:3}.ks-site .ks-status{grid-column:1/-1;grid-row:4}.ks-site .ks-form-aside{display:none}.ks-site .ks-form-layout{grid-template-columns:1fr}.ks-site .ks-success-icon{display:none}.ks-site .ks-success{gap:7px}.ks-site .ks-success h3{font-size:25px}.ks-site.ks-layout-split .ks-mini-programs{grid-template-columns:1fr 1fr;gap:0}.ks-site.ks-layout-split .ks-mini-card{grid-template-columns:44px minmax(0,1fr);min-height:54px;padding-right:7px;gap:7px}.ks-site.ks-layout-split .ks-mini-photo{width:44px;height:52px;min-height:52px}.ks-site.ks-layout-split .ks-mini-card:first-child{border-bottom:1px solid #deded2;border-right:0}.ks-site.ks-layout-split .ks-mini-card>span{display:block}.ks-site .ks-program-card h4{font-size:20px}.ks-site .ks-contact-content{grid-template-columns:1fr 1fr}.ks-site .ks-contact-block{padding:5px}.ks-site .ks-contact-block h4{font-size:14px;margin-bottom:3px}.ks-site .ks-contact-block p,.ks-site .ks-contact-block a{font-size:14px}.ks-site .ks-contact-source{line-height:1.15}.ks-site .ks-credits{gap:9px;line-height:1.25}}
  @container ks-site (max-width:420px) and (max-height:360px){.ks-site .ks-hero-copy{max-width:81%;padding:10px}.ks-site .ks-title{font-size:24px;line-height:1.02}.ks-site .ks-hero-actions .ks-primary{padding:9px 10px}.ks-site .ks-photo-credit{display:none}.ks-site .ks-program-card h4{font-size:18px}.ks-site .ks-booking-head h3{font-size:20px}.ks-site .ks-contact-content{gap:4px}.ks-site .ks-contact-block{padding:4px}.ks-site .ks-contact-block h4{margin-bottom:3px}.ks-site .ks-booking-layout{grid-template-columns:1fr}.ks-site .ks-booking-photo{display:none}}
  /* Fixed image rows keep portrait photos from determining the card height. */
  .ks-site .ks-mini-programs{grid-auto-rows:84px}.ks-site .ks-mini-card{height:84px;min-height:0;max-height:84px}.ks-site .ks-mini-photo{height:100%;min-height:0;max-height:100%}.ks-site.ks-layout-split .ks-mini-programs{grid-auto-rows:48px}.ks-site.ks-layout-split .ks-mini-card{height:48px;min-height:0;max-height:48px}.ks-site.ks-layout-split .ks-mini-photo{height:100%;min-height:0}
  .ks-site.ks-compact .ks-mini-programs{grid-auto-rows:58px}.ks-site.ks-compact .ks-mini-card{height:58px;max-height:58px}
  .ks-site .ks-hero{container-name:ks-hero;container-type:size}.ks-site .ks-hero-media{left:52%}.ks-site .ks-hero-image.ks-photo-code{object-position:60% 32%}
  @container ks-site (max-width:700px){.ks-site .ks-mini-programs{grid-auto-rows:58px}.ks-site .ks-mini-card{height:58px;max-height:58px}.ks-site .ks-hero-media{left:0}}
  @container ks-site (max-height:430px){.ks-site .ks-mini-programs{grid-auto-rows:58px}.ks-site .ks-mini-card{height:58px;max-height:58px}}
  @container ks-site (max-height:360px){.ks-site.ks-layout-split .ks-mini-programs{grid-auto-rows:58px}.ks-site.ks-layout-split .ks-mini-card{height:58px;max-height:58px}}
  @container ks-hero (min-width:621px) and (max-height:280px){.ks-site .ks-hero-copy{max-width:57%;padding:15px 22px}.ks-site .ks-eyebrow{display:block;font-size:14px;margin-bottom:7px}.ks-site .ks-title{font-size:32px;line-height:1.04;margin-bottom:11px}.ks-site.ks-heading-normal .ks-title{font-size:27px}.ks-site .ks-intro{display:none}}
  @container ks-hero (min-width:621px) and (max-height:210px){.ks-site .ks-hero-copy{padding:11px 20px}.ks-site .ks-eyebrow{margin-bottom:5px}.ks-site .ks-title{font-size:29px;margin-bottom:8px}.ks-site.ks-heading-normal .ks-title{font-size:25px}}
  .ks-site .ks-slot:disabled{opacity:1;background:#e7e5dd;border-color:#cbcbbf;color:#4d5548}.ks-site .ks-slot:disabled strong{color:#58604f}
  /* Keep long Hungarian headlines inside the text column at every preview size. */
  .ks-site .ks-hero{min-width:0}
  .ks-site .ks-hero-copy{flex-shrink:1;overflow-wrap:anywhere}
  .ks-site .ks-title{max-width:100%;white-space:normal;overflow-wrap:anywhere;-webkit-hyphens:auto;hyphens:auto}
  /* Service photos and controls share the available space; a filtered card
     stays a useful service detail instead of becoming an empty tall strip. */
  .ks-site .ks-program-grid{grid-auto-rows:minmax(0,1fr)}
  .ks-site .ks-program-card{min-width:0}
  .ks-site .ks-program-card h4,.ks-site .ks-program-card p{min-width:0;overflow-wrap:break-word}
  @container ks-site (max-width:700px){
    .ks-site .ks-program-card,.ks-site.ks-layout-split .ks-program-card{grid-template-columns:minmax(90px,32%) minmax(0,1fr);grid-template-rows:auto auto minmax(44px,auto);gap:6px 12px;padding:0 12px 0 0;align-content:center}
    .ks-site .ks-service-photo,.ks-site.ks-layout-split .ks-service-photo{grid-column:1;grid-row:1/4;align-self:stretch;min-height:0;height:100%;object-position:55% 42%}
    .ks-site .ks-program-card h4,.ks-site.ks-layout-split .ks-program-card h4{grid-column:2;grid-row:1;padding:8px 0 0;font-size:22px;line-height:1.12}
    .ks-site .ks-program-card p,.ks-site.ks-layout-split .ks-program-card p{grid-column:2;grid-row:2;padding:0;line-height:1.35}
    .ks-site .ks-program-card button,.ks-site.ks-layout-split .ks-program-card button{grid-column:2;grid-row:3;align-self:start;justify-self:start;max-width:100%;margin-bottom:8px;min-height:44px;padding:8px 12px}
    .ks-site .ks-program-grid[data-count="1"] .ks-program-card p{display:block}
    .ks-site .ks-program-grid[data-count="1"]{max-height:300px}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card p{display:none}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card{grid-template-rows:auto minmax(44px,auto);gap:3px 10px}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card button{grid-row:2;margin-bottom:6px}
    .ks-site .ks-program-grid[data-count="2"] .ks-service-photo{grid-row:1/3}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card h4{font-size:19px;padding-top:6px}
  }
  @container ks-site (max-width:700px) and (min-height:510px){
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card{grid-template-rows:auto auto minmax(44px,auto);gap:6px 12px}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card p{display:block}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card button{grid-row:3}
    .ks-site .ks-program-grid[data-count="2"] .ks-service-photo{grid-row:1/4}
  }
  /* A short landscape preview uses its width, not a clipped portrait layout. */
  @container ks-site (min-width:500px) and (max-height:330px){
    .ks-site .ks-header{padding:0 10px;min-height:44px;height:44px;gap:8px}
    .ks-site .ks-brand-name{font-size:25px}
    .ks-site .ks-nav{display:none}
    .ks-site .ks-menu-toggle{margin-left:auto!important}
    .ks-site .ks-stage{padding:7px 10px}
    .ks-site .ks-footer{display:none}
    .ks-site .ks-home{display:grid;grid-template-columns:minmax(0,1fr) minmax(170px,.55fr);gap:10px}
    .ks-site .ks-mini-programs,.ks-site.ks-layout-split .ks-mini-programs{grid-template-columns:1fr;grid-template-rows:1fr 1fr;grid-auto-rows:auto;gap:8px;min-height:0}
    .ks-site .ks-mini-card,.ks-site.ks-layout-split .ks-mini-card,.ks-site.ks-compact .ks-mini-card{height:100%;max-height:none;min-height:44px;grid-template-columns:62px minmax(0,1fr);padding-right:8px;gap:8px}
    .ks-site .ks-mini-photo,.ks-site.ks-layout-split .ks-mini-photo{width:62px;height:100%;min-height:0}
    .ks-site .ks-mini-card>svg,.ks-site .ks-mini-card small{display:none}
    .ks-site .ks-mini-card strong{font-size:16px;line-height:1.2}
    .ks-site .ks-hero-copy{padding:12px;max-width:78%}
    .ks-site .ks-title{font-size:26px;margin-bottom:12px;line-height:1.06}
    .ks-site.ks-heading-normal .ks-title{font-size:23px}
    .ks-site .ks-hero-actions .ks-primary{padding:9px 11px}
    .ks-site .ks-eyebrow,.ks-site .ks-intro,.ks-site .ks-photo-credit{display:none}
    .ks-site .ks-program-page{display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:44px minmax(0,1fr);gap:7px 10px}
    .ks-site .ks-program-page .ks-page-top{grid-column:1;grid-row:1}
    .ks-site .ks-program-page .ks-page-top>div{display:none}
    .ks-site .ks-program-page .ks-filters{grid-column:2;grid-row:1}
    .ks-site .ks-program-page .ks-program-grid{grid-column:1/-1;grid-row:2;grid-template-columns:1fr 1fr;gap:10px;max-height:none}
    .ks-site .ks-program-page .ks-program-grid[data-count="1"]{grid-template-columns:1fr}
    .ks-site .ks-program-card,.ks-site.ks-layout-split .ks-program-card{grid-template-columns:32% minmax(0,1fr);grid-template-rows:auto auto;gap:4px 10px;padding:0 10px 0 0;align-content:center}
    .ks-site .ks-service-photo,.ks-site.ks-layout-split .ks-service-photo{grid-column:1;grid-row:1/3;min-height:0;height:100%}
    .ks-site .ks-program-card h4,.ks-site.ks-layout-split .ks-program-card h4{grid-column:2;grid-row:1;font-size:20px;line-height:1.1;padding-top:6px}
    .ks-site .ks-program-card button,.ks-site.ks-layout-split .ks-program-card button{grid-column:2;grid-row:2;align-self:start;margin-bottom:6px;padding:7px 10px;min-height:44px}
    .ks-site .ks-program-card p{display:none}
    .ks-site .ks-program-grid[data-count="1"] .ks-program-card{grid-template-columns:32% minmax(0,1fr) auto;grid-template-rows:auto auto}
    .ks-site .ks-program-grid[data-count="1"] .ks-program-card p{display:block;grid-row:2;padding-bottom:8px}
    .ks-site .ks-program-grid[data-count="1"] .ks-program-card button{grid-column:3;grid-row:1/3;align-self:center;margin:0}
    .ks-site .ks-program-action-text{display:none}
    .ks-site .ks-program-action-short{display:inline}
    .ks-site .ks-calendar-note{display:none}
  }
  @container ks-site (max-width:499px) and (max-height:390px){
    .ks-site .ks-program-page{display:grid;grid-template-columns:44px minmax(0,1fr);grid-template-rows:44px minmax(0,1fr);gap:7px 8px}
    .ks-site .ks-program-page .ks-page-top{grid-column:1;grid-row:1}
    .ks-site .ks-program-page .ks-page-top>div{display:none}
    .ks-site .ks-program-page .ks-filters{grid-column:2;grid-row:1;gap:4px}
    .ks-site .ks-program-page .ks-filter{padding:7px 8px;min-width:0}
    .ks-site .ks-program-page .ks-program-grid{grid-column:1/-1;grid-row:2;gap:8px}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card{grid-template-columns:28% minmax(0,1fr) auto;grid-template-rows:1fr;gap:7px;padding-right:7px}
    .ks-site .ks-program-grid[data-count="2"] .ks-service-photo{grid-row:1}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card h4{align-self:center;padding:5px 0;font-size:18px}
    .ks-site .ks-program-grid[data-count="2"] .ks-program-card button{grid-column:3;grid-row:1;align-self:center;margin:0;padding:7px}
  }
  @container ks-site (max-height:285px){
    .ks-site .ks-menu{top:44px;left:8px;right:8px;min-width:0;display:grid;grid-template-columns:1fr 1fr;gap:2px;padding:5px}
    .ks-site .ks-menu a{min-height:44px;padding:7px 9px}
    .ks-site .ks-booking-page{gap:5px}
    .ks-site .ks-booking-head p{display:none!important}
    .ks-site .ks-calendar-main{gap:5px}
    .ks-site .ks-slot{min-height:44px;gap:2px;padding:5px 8px}
    .ks-site .ks-slot strong{font-size:18px}
  }
  @container ks-site (min-width:500px) and (max-height:250px){
    .ks-site .ks-booking-page{display:grid;grid-template-columns:145px minmax(0,1fr);gap:10px}
    .ks-site .ks-booking-head{align-self:start;align-items:center;gap:7px}
    .ks-site .ks-booking-head h3{font-size:20px}
    .ks-site .ks-booking-layout,.ks-site .ks-form-layout{display:block;min-height:0}
    .ks-site .ks-booking-photo,.ks-site .ks-form-aside{display:none}
    .ks-site .ks-calendar-main{height:100%}
    .ks-site .ks-slots{grid-template-columns:repeat(4,minmax(0,1fr));grid-template-rows:1fr}
    .ks-site .ks-slot span{font-size:14px;overflow-wrap:break-word}
    .ks-site .ks-success{gap:6px}
    .ks-site .ks-success h3{font-size:22px}
    .ks-site .ks-success small{display:none}
  }
  /* Construction mode reveals only pieces submitted by the team. */
  .ks-site.ks-building{--ks-accent:#4b5563;--ks-accent-soft:#eceef0;--ks-radius:0;background:#fff;color:#28302c}
  .ks-site.ks-building.ks-theme-violet{--ks-accent:#6e5470;--ks-accent-soft:#f0eaf0;background:#f7f4ed}
  .ks-site.ks-building.ks-theme-mint{--ks-accent:#42634b;--ks-accent-soft:#eaf0e8;background:#f7f4ed}
  .ks-site.ks-building.ks-theme-amber{--ks-accent:#a55231;--ks-accent-soft:#f6ebe4;background:#f7f4ed}
  .ks-site.ks-building.ks-rounded{--ks-radius:10px}
  .ks-site .ks-empty{display:grid;place-content:center;flex:1;min-width:0;min-height:0;text-align:center;color:#777d78;font-size:16px;padding:16px;line-height:1.4}
  .ks-site .ks-header:empty,.ks-site .ks-footer:empty{display:none}
  .ks-site .ks-brand-pending{color:#747a73;font-size:14px;letter-spacing:.03em}
  .ks-site .ks-services-pending{display:flex;align-items:center;justify-content:center;min-height:68px;border:1px dashed #c7cdc7;color:#737c72;font-size:16px}
  .ks-site .ks-hero.ks-no-photo{background:transparent;border:0}
  .ks-site .ks-hero.ks-no-photo:after{display:none}
  .ks-site .ks-hero.ks-no-photo .ks-hero-copy{max-width:100%}
  .ks-site .ks-hero.ks-photo-only .ks-hero-media{inset:0}
  .ks-site .ks-hero.ks-photo-only:after{display:none}
  .ks-site .ks-home.ks-no-hero{justify-content:center}
  .ks-site .ks-home.ks-no-services{display:flex}
  .ks-site .ks-mini-programs[data-count="1"]{grid-template-columns:1fr}
  .ks-site .ks-program-grid[data-count="0"]{display:flex}
  .ks-site .ks-program-page.ks-no-filters .ks-page-top{grid-column:1/-1}
  .ks-site .ks-program-page.ks-no-filters .ks-page-top>div{display:block}
  .ks-site.ks-building .ks-intro{display:block}
  .ks-site.ks-heading-pending .ks-title{font:600 clamp(22px,3.2cqw,35px)/1.14 Arial,'Segoe UI',sans-serif;letter-spacing:0}
  .ks-site .ks-build-note{position:absolute;z-index:10;left:12px;right:12px;bottom:12px;margin:auto;padding:12px 16px;max-width:430px;background:#27342e;color:#fff;border-radius:8px;text-align:center;font-size:16px;box-shadow:0 4px 16px #0002;pointer-events:none}
  .ks-site .ks-just-built{animation:ks-built-in 1.9s ease-out}
  @keyframes ks-built-in{0%{outline:3px solid #5e9b72;outline-offset:3px;filter:brightness(1.12);transform:translateY(4px)}20%{transform:translateY(0)}100%{outline:3px solid transparent;outline-offset:6px;filter:none}}
  @container ks-site (max-height:330px){.ks-site.ks-building .ks-intro{font-size:14px;line-height:1.25;margin-bottom:8px}.ks-site.ks-building .ks-title{margin-bottom:8px}.ks-site .ks-services-pending{min-height:44px}.ks-site .ks-empty{padding:8px}.ks-site .ks-home.ks-no-hero{display:flex}}
  @container ks-site (max-width:499px) and (max-height:390px){.ks-site.ks-building .ks-hero-copy{padding:10px}.ks-site.ks-building .ks-intro{font-size:14px;line-height:1.2;max-width:100%}.ks-site.ks-building .ks-title{font-size:23px}}
  @media (prefers-reduced-motion:reduce){.ks-site *{transition:none;animation:none;scroll-behavior:auto}.ks-site .ks-just-built{outline:2px solid #5e9b72;outline-offset:2px}}
  `;
  function installStyle(){
    if(document.getElementById('kando-shared-site-style'))return;
    const style=document.createElement('style');style.id='kando-shared-site-style';style.textContent=css;document.head.appendChild(style);
  }
  function photo(kind,className){
    const chosen=photos[kind]||photos.code;
    return `<img class="${className} ks-photo-${safe(kind)}" src="${chosen.src}" alt="${chosen.alt}" decoding="async">`;
  }
  function mini(c,kind){
    return `<button type="button" class="ks-mini-card" data-built="${kind==='code'?'cardCode':'cardNetwork'} borderStyle" data-action="program" data-program="${kind}">${photo(kind==='code'?'network':'code','ks-mini-photo')}<span><strong>${kind==='code'?'Fürdetés':'Teljes kozmetika'}</strong><small>${text(c,kind==='code'?'cardCode':'cardNetwork')}</small></span>${arrow}</button>`;
  }
  function home(c,build=null){
    const hasHero=anyBuilt(build,'title','intro','hero','buttonLabel','buttonTarget');
    const hasPhoto=built(build,'hero'),hasCopy=anyBuilt(build,'title','intro','buttonLabel','buttonTarget');
    const services=['code','network'].filter(kind=>built(build,kind==='code'?'cardCode':'cardNetwork'));
    const hasServices=services.length||built(build,'layout');
    if(!hasHero&&!hasServices)return emptyPage();
    return `<section class="ks-home ${hasHero?'':'ks-no-hero'} ${hasServices?'':'ks-no-services'}" aria-label="Tücsök Kutyakozmetika">${hasHero?`<div class="ks-hero ${hasPhoto?'':'ks-no-photo'} ${hasCopy?'':'ks-photo-only'}">${hasPhoto?`<div class="ks-hero-media" data-built="hero">${photo(c.hero,'ks-hero-image')}</div>`:''}${hasCopy?`<div class="ks-hero-copy">${built(build,'title')?`<h2 class="ks-title" data-built="title headingSize">${text(c,'title')}</h2>`:''}${built(build,'intro')?`<p class="ks-intro" data-built="intro">${text(c,'intro')}</p>`:''}${anyBuilt(build,'buttonLabel','buttonTarget')?`<div class="ks-hero-actions" data-built="buttonLabel buttonTarget">${mainButton(built(build,'buttonLabel')?c:{...c,buttonLabel:'join'})}</div>`:''}</div>`:''}${hasPhoto?'<span class="ks-photo-credit">Illusztráció</span>':''}</div>`:''}${hasServices?`<div class="ks-mini-programs" data-built="layout" data-count="${services.length}">${services.length?services.map(kind=>mini(c,kind)).join(''):'<div class="ks-services-pending">Ide kerülnek a szolgáltatások.</div>'}</div>`:''}</section>`;
  }
  function top(title,sub,action='home',booking=false){return `<div class="ks-page-top ${booking?'ks-booking-head':''}"><button type="button" class="ks-back" data-action="${action}" aria-label="${action==='calendar'?'Vissza az időpontokhoz':'Vissza a kezdőlapra'}">${arrow}</button><div><h3 tabindex="-1">${title}</h3>${sub?`<p>${sub}</p>`:''}</div></div>`;}
  function programs(c,state,build=null){
    const available=kind=>built(build,kind==='code'?'cardCode':'cardNetwork');
    const show=kind=>available(kind)&&(!built(build,'filterRule')||c.filterRule!=='match'||state.filter==='all'||state.filter===kind);
    const count=Number(show('code'))+Number(show('network'));
    const card=kind=>available(kind)?`<article class="ks-program-card" data-built="${kind==='code'?'cardCode':'cardNetwork'} borderStyle" ${show(kind)?'':'hidden'}>${photo(kind==='code'?'network':'code','ks-service-photo')}<h4>${kind==='code'?'Fürdetés':'Teljes kozmetika'}</h4><p>${text(c,kind==='code'?'cardCode':'cardNetwork')}</p><button type="button" data-action="choose" data-program="${kind}"><span class="ks-program-action-text">Időpontot kérek</span><span class="ks-program-action-short">Időpont</span>${arrow}</button></article>`:'';
    const filters=built(build,'filterRule')?`<div class="ks-filters" data-built="filterRule" role="group" aria-label="Szolgáltatások szűrése">${[['all','Mind'],['code','Fürdetés'],['network','Teljes']].map(([id,label])=>`<button type="button" class="ks-filter" data-action="filter" data-filter="${id}" aria-pressed="${state.filter===id}">${label}</button>`).join('')}<span class="ks-filter-count">${count} szolgáltatás</span></div>`:'';
    return `<section class="ks-page ks-program-page ${filters?'':'ks-no-filters'}" aria-label="Szolgáltatások">${top('Szolgáltatások','')}${filters}<div class="ks-program-grid" data-built="layout" data-count="${count}">${count?card('code')+card('network'):emptyPage()}</div></section>`;
  }
  function makeDemoDays(){
    return Array.from({length:7},(_,index)=>{
      const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+index+1);
      return {label:date.toLocaleDateString('hu-HU',{month:'long',day:'numeric'}),weekday:date.toLocaleDateString('hu-HU',{weekday:'long'})};
    });
  }
  function demoSlot(state,index){
    const time=demoTimes[index],key=state.dayIndex+'/'+time;
    const name=state.reservations[key]||(index%2===state.dayIndex%2?demoNames[(state.dayIndex+index)%demoNames.length]:'');
    return {time,key,name};
  }
  function calendar(c,state){
    const day=state.days[state.dayIndex],slots=demoTimes.map((_,index)=>demoSlot(state,index)),free=slots.filter(slot=>!slot.name).length;
    return `<section class="ks-page ks-booking-page" aria-label="Bemutató időpontfoglaló">${top('Bemutató foglaló','Valódi időpontot nem rögzítünk.','home',true)}<div class="ks-booking-layout"><aside class="ks-booking-photo">${photo('team','')}<span>Minden név és időpont kitalált.<br>A szabad idősávokkal kipróbálhatod a foglalást.</span></aside><div class="ks-calendar-main"><div class="ks-day-nav"><button type="button" data-action="day-prev" aria-label="Előző nap" ${state.dayIndex===0?'disabled':''}>←</button><div class="ks-day-label" aria-live="polite"><strong>${safe(day.label)}</strong><span>${safe(day.weekday)} · ${free} szabad</span></div><button type="button" data-action="day-next" aria-label="Következő nap" ${state.dayIndex===state.days.length-1?'disabled':''}>→</button></div><div class="ks-slots">${slots.map((slot,index)=>`<button type="button" class="ks-slot" data-action="slot" data-slot="${index}" ${slot.name?'disabled':''} aria-label="${slot.time} – ${slot.name?'Foglalt, kitalált név: '+safe(slot.name):'Szabad időpont'}"><strong>${slot.time}</strong><span>${slot.name?'Foglalt · '+safe(slot.name):'Szabad · választom'}</span></button>`).join('')}</div><p class="ks-calendar-note">A foglalt helyeken is kitalált kutyanevek láthatók.</p></div></div></section>`;
  }
  function signup(c,state,build=null){
    if(state.success&&built(build,'feedback')&&c.feedback==='visible')return `<section class="ks-page" aria-label="Sikeres próba"><div class="ks-success" role="status"><span class="ks-success-icon" aria-hidden="true">✓</span><h3>A próbafoglalás sikerült.</h3><p><strong>${safe(state.name||'Buksi')}</strong> · ${state.count} kutya<br>${safe(state.days[state.selectedSlot.dayIndex].label)} · ${state.selectedSlot.time}</p><small>Bemutató foglaló.<br>Valódi időpontot nem rögzítettünk.</small><div class="ks-success-actions"><button type="button" class="ks-primary" data-action="calendar">Megnézem a naptárt</button><button type="button" data-action="home">Kezdőlap</button></div></div></section>`;
    if(state.bookingStep!=='form'||!state.selectedSlot)return calendar(c,state);
    const selected=state.selectedSlot,day=state.days[selected.dayIndex];
    return `<section class="ks-page ks-booking-page" aria-label="Időpontkérés">${top('Időpont: '+selected.time,safe(day.label)+' · '+safe(day.weekday),'calendar',true)}<div class="ks-form-layout"><aside class="ks-form-aside">${photo(state.program==='code'?'network':'team','')}<h4>${state.program==='code'?'Fürdetés':state.program==='network'?'Teljes kozmetika':'A kutyád adatai'}</h4><p>A próbához kitalált kutyanevet használj.</p></aside><form class="ks-form" novalidate><div><label class="ks-field-label" for="${state.inputId}">Kitalált kutyanév</label><input class="ks-name" id="${state.inputId}" name="demo-name" type="text" inputmode="text" autocomplete="off" maxlength="40" placeholder="Pl. Buksi" value="${safe(state.name)}" aria-invalid="${Boolean(state.error)}" aria-describedby="${state.inputId}-note ${state.inputId}-status"></div><p class="ks-local-note" id="${state.inputId}-note">Bemutató. Valódi időpontot nem rögzítünk.</p>${built(build,'counterRule')?`<div class="ks-count-row" data-built="counterRule"><span class="ks-count-label">Kutyák száma</span><div class="ks-stepper" role="group" aria-label="Kutyák száma"><button type="button" data-action="minus" aria-label="Eggyel kevesebb kutya" ${state.count<=1?'disabled':''}>−</button><output aria-live="polite" aria-label="Kutyák száma">${state.count}</output><button type="button" data-action="plus" aria-label="Eggyel több kutya" ${state.count>=20?'disabled':''}>+</button></div></div>`:''}<button type="submit" class="ks-primary">Próbafoglalás ${arrow}</button><p class="ks-status" id="${state.inputId}-status" role="status" ${c.feedback==='hidden'?'hidden':''}>${state.error?'Írj be egy kutyanevet.':''}</p></form></div></section>`;
  }
  function contact(){return `<section class="ks-page ks-contact-page" aria-label="Kapcsolat">${top('Kapcsolat','Tücsök Kutyakozmetika')}<div class="ks-contact-content"><div class="ks-contact-block"><h4>Cím</h4><p>${business.address}</p></div><div class="ks-contact-block"><h4>Telefon</h4><a href="tel:+36204255441">${business.phone}</a></div><div class="ks-contact-block"><h4>Nyitvatartás</h4><p>${business.hours}</p></div><div class="ks-contact-block"><h4>Időpontegyeztetés</h4><p class="ks-contact-small">Valódi időpontot a szalonnal telefonon egyeztess.</p></div></div><p class="ks-contact-source">Üzleti adatok: <a href="${business.source}" target="_blank" rel="noopener noreferrer">a szalon hivatalos Facebook-oldala</a>.</p></section>`;}
  function credits(){return `<section class="ks-page" aria-label="A fotókról">${top('A fotókról','')}<div class="ks-credits"><p>A képek <strong>stockfotók, illusztrációk</strong>. Nem a Tücsök Kutyakozmetika helyszínét vagy saját vendégeit mutatják.</p><p>Tima Miroshnichenko: <a href="https://www.pexels.com/photo/person-grooming-hair-of-yorkshire-terrier-6131569/" target="_blank" rel="noopener noreferrer">ápolás</a> · <a href="https://www.pexels.com/photo/close-up-photo-of-bathing-of-dog-6131165/" target="_blank" rel="noopener noreferrer">fürdetés</a>.<br>Goochie Poochie Grooming: <a href="https://www.pexels.com/photo/studio-shot-of-dog-with-red-bandana-3361723/" target="_blank" rel="noopener noreferrer">kutyaportré</a>.</p><p>Pexels · <a href="https://www.pexels.com/license/" target="_blank" rel="noopener noreferrer">felhasználási engedély</a>.</p></div></section>`;}
  let serial=0;
  function siteClasses(c,options,build){
    return `ks-site ${build===null?'':'ks-building'} ${built(build,'theme')?'ks-theme-'+themeOf(c):'ks-theme-pending'} ks-layout-${built(build,'layout')&&c.layout==='split'?'split':'cards'} ks-heading-${built(build,'headingSize')?(c.headingSize==='normal'?'normal':'large'):'pending'} ${built(build,'borderStyle')?(c.borderStyle==='square'?'ks-square':'ks-rounded'):''} ${options.compact?'ks-compact':''}`;
  }
  function header(c,build){
    const brand=built(build,'title')?'<a class="ks-brand" href="#home" data-route="home" aria-label="Tücsök Kutyakozmetika, kezdőlap"><span class="ks-brand-name">Tücsök</span><span class="ks-brand-description">kutyakozmetika</span></a>':'';
    const navigation=anyBuilt(build,'navTarget','menuRule')?'<nav class="ks-nav" data-built="navTarget" aria-label="Oldalnavigáció"><a href="#programs" data-route="programs">Szolgáltatások</a><a href="#signup" data-route="signup">Időpont</a><a href="#contact" data-route="contact">Kapcsolat</a></nav><button class="ks-menu-toggle" data-built="menuRule" type="button" data-action="menu" aria-expanded="false" aria-label="Menü megnyitása"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>':'';
    return brand+navigation;
  }
  const menuLinks='<a href="#home" data-route="home">Kezdőlap</a><a href="#programs" data-route="programs">Szolgáltatások</a><a href="#signup" data-route="signup">Bemutató foglaló</a><a href="#contact" data-route="contact">Kapcsolat</a><a href="#credits" data-route="credits">Fotók és források</a>';
  const footer=(c,build)=>built(build,'footerText')?`<span data-built="footerText">${text(c,'footerText')}</span><a href="#credits" data-route="credits">Fotók: illusztrációk</a>`:'';
  function page(c,state,build){
    if(state.view==='programs')return programs(c,state,build);
    if(state.view==='signup')return built(build,'formRule')?signup(c,state,build):`<section class="ks-page">${top('Időpontkérés','')}${emptyPage()}</section>`;
    if(state.view==='contact')return built(build,'footerText')?contact():`<section class="ks-page">${top('Kapcsolat','')}${emptyPage()}</section>`;
    if(state.view==='credits')return credits();
    return home(c,build);
  }
  function initialState(options={}){return {view:['home','programs','signup','contact','credits'].includes(options.view)?options.view:'home',filter:'all',menu:false,count:1,name:'',program:null,error:false,success:false,bookingStep:'calendar',selectedSlot:null,dayIndex:0,days:makeDemoDays(),reservations:Object.create(null),inputId:`ks-example-${++serial}`};}
  function html(config,options={}){
    installStyle();const c=configOf(config),build=buildOf(options),state=initialState(options);
    return `<div class="${siteClasses(c,options,build)}" data-view="${state.view}"><div class="ks-header">${header(c,build)}</div><nav class="ks-menu" aria-label="Kinyitott menü" hidden>${menuLinks}</nav><div class="ks-stage">${page(c,state,build)}</div><div class="ks-footer">${footer(c,build)}</div><div class="ks-build-note" role="status" hidden></div></div>`;
  }
  function bind(root,config,onAction,options={}){
    const site=root?.matches?.('.ks-site')?root:root?.querySelector?.('.ks-site');if(!site)return;
    if(site._kandoCleanup)site._kandoCleanup();
    let c=configOf(config),settings={...options},build=buildOf(settings),disposed=false,noticeTimer=0,highlightTimer=0;
    const state=initialState(options),stage=site.querySelector('.ks-stage');
    let stageMarkup='',headerMarkup='',footerMarkup='';
    const emit=(action,result,detail={})=>{if(typeof onAction==='function')onAction({action,result,detail});};
    function menu(){const panel=site.querySelector('.ks-menu'),toggle=site.querySelector('.ks-menu-toggle');if(!toggle)state.menu=false;panel.hidden=!state.menu;toggle?.setAttribute('aria-expanded',String(state.menu));toggle?.setAttribute('aria-label',state.menu?'Menü bezárása':'Menü megnyitása');}
    function render(focus=false){
      site.dataset.view=state.view;site.className=siteClasses(c,settings,build);
      const nextHeader=header(c,build),nextFooter=footer(c,build),nextStage=page(c,state,build);
      if(nextHeader!==headerMarkup){site.querySelector('.ks-header').innerHTML=nextHeader;headerMarkup=nextHeader;}
      if(nextFooter!==footerMarkup){site.querySelector('.ks-footer').innerHTML=nextFooter;footerMarkup=nextFooter;}
      if(nextStage!==stageMarkup){
        const active=document.activeElement,restoreName=active?.matches?.('.ks-name')&&site.contains(active),selection=restoreName?[active.selectionStart,active.selectionEnd]:null;
        stage.innerHTML=nextStage;stageMarkup=nextStage;
        if(restoreName){const field=stage.querySelector('.ks-name');field?.focus({preventScroll:true});if(field&&selection)field.setSelectionRange(...selection);}
      }
      menu();if(focus)stage.querySelector('h3')?.focus({preventScroll:true});
    }
    function go(view){if(!['home','programs','signup','contact','credits'].includes(view))view='home';state.view=view;state.menu=false;state.error=false;state.success=false;if(view==='signup'){state.bookingStep='calendar';state.selectedSlot=null;}render(true);emit('view',state.view);}
    function notice(message){const node=site.querySelector('.ks-build-note');if(!node)return;clearTimeout(noticeTimer);node.textContent=message;node.hidden=false;noticeTimer=setTimeout(()=>{node.hidden=true;},3000);}
    function highlight(key){
      clearTimeout(highlightTimer);site.querySelectorAll('.ks-just-built').forEach(node=>node.classList.remove('ks-just-built'));
      if(!key)return;const nodes=Array.from(site.querySelectorAll('[data-built]')).filter(node=>node.dataset.built.split(' ').includes(key));
      if(['theme','borderStyle','formRule','feedback','counterRule'].includes(key))nodes.push(stage);
      nodes.forEach(node=>node.classList.add('ks-just-built'));highlightTimer=setTimeout(()=>nodes.forEach(node=>node.classList.remove('ks-just-built')),2100);
    }
    function click(event){
      const control=event.target.closest('[data-action],[data-route]');if(!control||control.disabled||!site.contains(control))return;
      if(control.dataset.route){event.preventDefault();const source=control.dataset.route;if(source==='programs'&&!built(build,'navTarget')){notice('Ez a menüpont még nincs bekötve.');emit('nav','unbound',{source});return;}const target=source==='programs'?c.navTarget:source;go(['signup','programs','contact','credits'].includes(target)?target:'home');emit('nav',state.view,{source});return;}
      const action=control.dataset.action;
      if(action==='menu'){state.menu=c.menuRule==='open'?true:!state.menu;menu();emit('menu',state.menu?'open':'closed');}
      else if(action==='hero'){if(!built(build,'buttonTarget')){notice('A gomb már kész. A célját még be kell kötni.');emit('cta','unbound');}else emit('cta',routeMainButton(c.buttonTarget,go));}
      else if(action==='home'){go('home');emit('back','home');}
      else if(action==='program'){state.filter=control.dataset.program;go('programs');emit('program',state.filter);}
      else if(action==='choose'){state.program=control.dataset.program;go('signup');emit('choose',state.program);}
      else if(action==='day-prev'||action==='day-next'){state.dayIndex=Math.max(0,Math.min(state.days.length-1,state.dayIndex+(action==='day-next'?1:-1)));state.selectedSlot=null;render();stage.querySelector(`[data-action="${action}"]`)?.focus({preventScroll:true});}
      else if(action==='slot'){const index=Number(control.dataset.slot);if(!Number.isInteger(index)||index<0||index>=demoTimes.length)return;const slot=demoSlot(state,index);if(slot.name)return;state.selectedSlot={dayIndex:state.dayIndex,time:slot.time,key:slot.key};state.bookingStep='form';state.error=false;state.success=false;render(true);}
      else if(action==='calendar'){state.view='signup';state.bookingStep='calendar';state.selectedSlot=null;state.success=false;state.error=false;render(true);}
      else if(action==='filter'){state.filter=control.dataset.filter;render();stage.querySelector(`[data-filter="${state.filter}"]`)?.focus({preventScroll:true});emit('filter',c.filterRule==='match'?state.filter:'all',{selected:state.filter});}
      else if(action==='plus'||action==='minus'){const step=c.counterRule==='two'?2:1,before=state.count;state.count=Math.max(1,Math.min(20,state.count+(action==='plus'?step:-step)));render();stage.querySelector(`[data-action="${action}"]`)?.focus({preventScroll:true});emit('counter',state.count,{delta:state.count-before,direction:action});}
    }
    function input(event){if(event.target.matches('.ks-name')){state.name=event.target.value;if(state.error){state.error=false;event.target.setAttribute('aria-invalid','false');stage.querySelector('.ks-status').textContent='';}}}
    function submit(event){if(!event.target.matches('.ks-form')||!state.selectedSlot)return;event.preventDefault();state.name=event.target.querySelector('.ks-name').value.trim();state.error=c.formRule!=='always'&&!state.name;state.success=!state.error;if(state.success)state.reservations[state.selectedSlot.key]=state.name||'Buksi';render();if(state.error)stage.querySelector('.ks-name')?.focus({preventScroll:true});emit('submit',state.error?'empty':!built(build,'feedback')||c.feedback==='hidden'?'success-hidden':'success',{empty:!state.name});}
    function keydown(event){if(event.key==='Escape'&&state.menu){state.menu=false;menu();site.querySelector('.ks-menu-toggle')?.focus({preventScroll:true});}}
    site.addEventListener('click',click);site.addEventListener('input',input);site.addEventListener('submit',submit);site.addEventListener('keydown',keydown);
    const cleanup=()=>{disposed=true;clearTimeout(noticeTimer);clearTimeout(highlightTimer);site.removeEventListener('click',click);site.removeEventListener('input',input);site.removeEventListener('submit',submit);site.removeEventListener('keydown',keydown);};
    cleanup.update=(nextConfig,nextOptions={})=>{
      if(disposed)return;
      const before=c,previousBuild=build;c=configOf(nextConfig);settings={...settings,...nextOptions};build=buildOf(settings);
      if(nextOptions.view&&nextOptions.view!==state.view)go(nextOptions.view);else render();
      const added=build?Array.from(build).filter(key=>previousBuild!==null&&!previousBuild.has(key)):[];
      const changed=Object.keys(c).filter(key=>c[key]!==before[key]&&built(build,key));
      highlight(nextOptions.focusKey||added.at(-1)||changed.at(-1));
    };
    cleanup.go=go;cleanup.getView=()=>state.view;
    site._kandoCleanup=cleanup;render();highlight(options.focusKey);return cleanup;
  }
  function source(config,kind){
    const c=configOf(config);
    if(kind==='html')return {label:'HTML · a gomb szövege',code:mainButton(c),explanation:`Ez a gomb szerepel az oldalon: „${copy.buttonLabel[c.buttonLabel]||copy.buttonLabel.try}”.`};
    if(kind==='css')return {label:'CSS · a gomb színe',code:accentRules(themeOf(c))+'\n'+buttonColorRule,explanation:'Ugyanezek a szabályok adják a közös oldal választott színét.'};
    if(kind==='javascript')return {label:'JavaScript · a gomb működése',code:routeMainButton.toString()+`\n\nrouteMainButton(${JSON.stringify(c.buttonTarget)}, go);`,explanation:c.buttonTarget==='programs'?'A fő gomb most a szolgáltatásokhoz vezet.':'A fő gomb most az időpontkéréshez vezet.'};
    return null;
  }
  installStyle();window.KandoSite={html,bind,source,viewForKey};
})();
