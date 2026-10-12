// Generates synthetic student CVs across many fields. Deterministic (seeded) so runs are reproducible.
"use strict";
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
const FIELDS=[
 {key:"medtech",prog:"MSc Medical Engineering",uni:"KTH Royal Institute of Technology",expect:["Medical imaging","AI & machine learning"],skills:["Python","MATLAB","MRI","image segmentation","deep learning","PyTorch","signal processing","FHIR","ultrasound","CT"],projects:["U-Net segmentation of brain MRI","ultrasound phantom measurements","FHIR app for heart-rate data","CT reconstruction lab"],goal:"MSc thesis in medical imaging and AI"},
 {key:"cs-ai",prog:"MSc Machine Learning",uni:"KTH Royal Institute of Technology",expect:["AI & machine learning","Software & data"],skills:["Python","PyTorch","machine learning","deep learning","statistics","Git","Linux","computer vision","NLP"],projects:["transformer fine-tuning","image classification benchmark","Kaggle competition"],goal:"research assistant job in machine learning"},
 {key:"robotics",prog:"MSc Systems, Control and Robotics",uni:"KTH Royal Institute of Technology",expect:["Robotics","AI & machine learning"],skills:["ROS","C++","Python","robotics","control theory","computer vision","embedded","Arduino"],projects:["robot arm pick-and-place","SLAM on a mobile robot"],goal:"part-time robotics research engineer"},
 {key:"mech",prog:"MSc Engineering Mechanics",uni:"KTH Royal Institute of Technology",expect:["Biomechanics","Engineering"],skills:["finite element","mechanics","MATLAB","COMSOL","CAD","SolidWorks","Python"],projects:["FE model of a knee joint","fluid flow simulation"],goal:"PhD in computational mechanics"},
 {key:"physics",prog:"MSc Engineering Physics",uni:"KTH Royal Institute of Technology",expect:["Physics & hardware","Mathematics"],skills:["physics","Python","C++","optimization","mathematics","X-ray","detector physics"],projects:["photon detector characterisation","Monte Carlo simulation"],goal:"thesis in medical physics or detectors"},
 {key:"chem",prog:"MSc Chemical Engineering",uni:"KTH Royal Institute of Technology",expect:["Life science","Engineering"],skills:["chemistry","lab work","HPLC","spectroscopy","Python","data analysis"],projects:["polymer synthesis","electrochemistry lab"],goal:"research assistant in chemistry"},
 {key:"biotech",prog:"MSc Biotechnology",uni:"KTH Royal Institute of Technology",expect:["Life science","Biophysics & microscopy"],skills:["cell culture","PCR","microscopy","biology","genomics","R","bioinformatics"],projects:["CRISPR knockout in HEK cells","fluorescence microscopy of neurons"],goal:"lab research assistant in cell biology"},
 {key:"medicine",prog:"Medical Programme (Läkarprogrammet)",uni:"Karolinska Institutet",expect:["Pathology & cancer","Medical imaging","Neuroscience"],skills:["clinical","research","statistics","R","pathology","radiology","Swedish","English"],projects:["case report in oncology","literature review on breast cancer screening"],goal:"research project in cancer or radiology"},
 {key:"epi",prog:"MSc Public Health Epidemiology",uni:"Karolinska Institutet",expect:["Epidemiology & public health"],skills:["epidemiology","biostatistics","R","Stata","survey","registry data","public health"],projects:["cohort study on diabetes","survey analysis"],goal:"hourly research assistant in epidemiology"},
 {key:"bmed",prog:"BSc Biomedicine",uni:"Karolinska Institutet",expect:["Life science","Pathology & cancer"],skills:["cell culture","PCR","immunology","biology","lab work","flow cytometry"],projects:["T-cell activation assay","tumour immunology lab rotation"],goal:"research assistant in a wet lab"},
 {key:"nursing",prog:"BSc Nursing",uni:"Karolinska Institutet",expect:["Epidemiology & public health","Women's health"],skills:["healthcare","clinical","patient care","Swedish","English","survey"],projects:["quality improvement project on a ward"],goal:"research assistant in healthcare or women's health"},
 {key:"psych",prog:"MSc Psychology",uni:"Stockholm University",expect:["Psychology","Neuroscience"],skills:["psychology","statistics","SPSS","R","experiments","qualitative","survey"],projects:["experiment on working memory","interview study"],goal:"PhD or research assistant in psychology"},
 {key:"neuro",prog:"MSc Neuroscience",uni:"Karolinska Institutet",expect:["Neuroscience","Medical imaging"],skills:["neuroscience","MRI","PET","Python","MATLAB","statistics","EEG"],projects:["fMRI analysis of attention","PET image preprocessing"],goal:"thesis in neuroimaging"},
 {key:"econ",prog:"MSc Economics",uni:"Stockholm School of Economics",expect:["Economics & policy"],skills:["economics","econometrics","Stata","R","policy","finance","Excel"],projects:["thesis on labour market policy","regression analysis of housing prices"],goal:"student assistant or research assistant in economics"},
 {key:"finance",prog:"BSc Business and Economics",uni:"Stockholm School of Economics",expect:["Economics & policy"],skills:["finance","Excel","accounting","marketing","economics","Python"],projects:["valuation case","marketing analytics"],goal:"student job"},
 {key:"dsv",prog:"MSc Computer and Systems Sciences",uni:"Stockholm University",expect:["Software & data","AI & machine learning","Design & HCI"],skills:["Java","SQL","cybersecurity","Python","UX","HCI","machine learning","IoT"],projects:["IoT sensor dashboard","usability study of an app"],goal:"PhD in computer and systems sciences"},
 {key:"design",prog:"MSc Interaction Design",uni:"KTH Royal Institute of Technology",expect:["Design & HCI"],skills:["UX","design","Figma","HCI","prototyping","user research"],projects:["redesign of a health app","VR prototype"],goal:"research in human-computer interaction"},
 {key:"ling",prog:"MA Linguistics",uni:"Stockholm University",expect:["Humanities"],skills:["linguistics","sign language","corpus","R","writing","teaching"],projects:["corpus study of child language"],goal:"PhD in linguistics"},
 {key:"phil",prog:"MA Philosophy",uni:"Stockholm University",expect:["Humanities"],skills:["philosophy","logic","writing","ethics","teaching"],projects:["essay on philosophy of science"],goal:"PhD in philosophy"},
 {key:"edu",prog:"Teacher Education (Ämneslärarprogrammet)",uni:"Stockholm University",expect:["Education","Mathematics"],skills:["teaching","mathematics","statistics","Swedish","education"],projects:["teaching practice in upper secondary school"],goal:"PhD in science or mathematics education"},
 {key:"eco",prog:"MSc Ecology",uni:"Stockholm University",expect:["Ecology & environment"],skills:["ecology","field work","R","GIS","biology","statistics"],projects:["wetland biodiversity survey"],goal:"PhD in ecology"},
 {key:"music",prog:"BA Music Performance",uni:"Royal College of Music",expect:["Music & arts"],skills:["piano","composition","teaching","audio"],projects:["concert series"],goal:"student job"},
 {key:"arts",prog:"BFA Fine Arts",uni:"Konstfack University of Arts, Crafts and Design",expect:["Music & arts","Design & HCI"],skills:["design","illustration","exhibition","writing"],projects:["exhibition at Konstfack"],goal:"student job"},
 {key:"sport",prog:"BSc Sport Science",uni:"Swedish School of Sport and Health Sciences",expect:["Epidemiology & public health"],skills:["physiology","exercise testing","statistics","public health"],projects:["VO2max study"],goal:"research assistant"},
 {key:"law",prog:"Master of Laws",uni:"Stockholm University",expect:["Law"],skills:["law","writing","EU law","Swedish"],projects:["moot court"],goal:"student assistant"},
];
const NAMES=["Alva Lindqvist","Omar Haddad","Wei Zhang","Sara Nilsson","Lucas Berg","Priya Raman","Elin Johansson","Mateo García","Hanna Ek","Yusuf Demir","Ingrid Holm","Arjun Mehta","Maja Sjöberg","Leo Andersson","Fatima Ali","Nora Karlsson","Emil Lund","Aisha Khan","Viktor Svensson","Lin Chen"];
const LEVELS=["Bachelor's","Master's","Master's","Master's","Exchange student","Recent graduate"];
function pick(r,a){return a[Math.floor(r()*a.length)]}
function sample(r,a,n){const c=a.slice();const out=[];while(c.length&&out.length<n)out.push(c.splice(Math.floor(r()*c.length),1)[0]);return out}
function makePersonas(n,seed=7){
  const r=rng(seed);const out=[];
  for(let i=0;i<n;i++){
    const f=FIELDS[i%FIELDS.length];const name=pick(r,NAMES);const sk=sample(r,f.skills,Math.min(f.skills.length,4+Math.floor(r()*4)));const pr=sample(r,f.projects,1+Math.floor(r()*2));
    const lvl=pick(r,LEVELS);const yr=pick(r,["1st year","2nd year","Final year"]);
    const variant=i%10;
    let cv;
    if(variant===9) cv=name+"\n"+f.prog; // very short CV (edge case)
    else if(variant===8) cv=`${name} — ${f.prog}, ${f.uni} (${yr})\nKompetenser: ${sk.join(", ")}.\nProjekt: ${pr.join("; ")}.\nSpråk: svenska, engelska.` // Swedish CV
    else cv=`${name}\n${name.toLowerCase().replace(/[^a-z]+/g,".")}@student.example.se\n\nEDUCATION\n${f.prog}, ${f.uni} (${yr})\n\nSKILLS\n${sk.join(", ")}\n\nPROJECTS\n${pr.map(p=>"- "+p).join("\n")}\n\nLANGUAGES\nEnglish (fluent), Swedish (${pick(r,["native","B1","basic"])})\n\nEXPERIENCE\n${pick(r,["Teaching assistant in an introductory course","Summer job at a hospital","Barista","Student union board member","Internship at a medtech company"])}`+(variant===7?"\n\n"+"Additional coursework and activities. ".repeat(400):"");
    out.push({i,key:f.key,name,prog:f.prog,uni:f.uni,level:lvl,year:yr,skills:sk,expect:f.expect,goal:f.goal,cv,interests:sk.join(", ")});
  }
  return out;
}
module.exports={makePersonas,rng,FIELDS};
