import { PrismaClient } from "@prisma/client";
import { access, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

type QaPair = {
  question: string;
  answer: string;
};

const OFFICIAL_FAQ: Array<{
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string;
}> = [

  // ─── A) BRAND & COMPANY BASICS (Q1–Q14) ───────────────────────────────────
  {
    id: "faq-Q1",
    question: "What is Hey Concrete?",
    answer:
      "Hey Concrete is India's leading design-first concrete surface brand, crafting architectural experiences using Ultra High Performance Concrete (UHPC). Over 3,000 architects, designers, and homeowners have chosen us to turn ordinary walls into unforgettable surfaces.",
    category: "brand",
    keywords:
      "hey concrete,what is hey concrete,about hey concrete,who is hey concrete,wabi sabi,company background,brand story",
  },
  {
    id: "faq-Q2",
    question: "Where are you based? Do you deliver pan-India?",
    answer:
      "We're based in Udaipur, Rajasthan—every panel is handcrafted at our own facility. We deliver pan-India, on time, and also ship internationally.",
    category: "brand",
    keywords:
      "based,location,udaipur,rajasthan,deliver,pan india,where,headquarters,factory",
  },
  {
    id: "faq-Q3",
    question: "Are your products made in India?",
    answer:
      "100% made in India. Every panel passes through three stages of quality checks before it leaves our Udaipur facility. GreenPro certified, precision-engineered.",
    category: "brand",
    keywords:
      "made in india,indian,origin,manufactured,domestic,local,green pro,greenPro",
  },
  {
    id: "faq-Q4",
    question: "How experienced are you as a brand?",
    answer:
      "3,000+ projects pan-India in just 3 years. That's a brand that has already handled real Indian conditions—scorching summers, heavy monsoons, dusty construction sites, and tight deadlines.",
    category: "brand",
    keywords:
      "experience,track record,projects,years,how old,established,history,proven",
  },
  {
    id: "faq-Q5",
    question: "What do you specialize in?",
    answer:
      "Three product lines: Designer UHPC wall panels (40+ designs), Breeze blocks / jali partitions (12 designs), and Teraline brick cladding. Most clients come for one and end up using all three.",
    category: "brand",
    keywords:
      "specialize,products,what do you sell,range,portfolio,lineup,what you make",
  },
  {
    id: "faq-Q6",
    question: "What makes Hey Concrete different from others?",
    answer:
      "Four unique things: 1) Patented exclusive designs, 2) UHPC material performance (M70+ strength, 100+ year lifespan), 3) Full execution support (layout, 3D visualization, installation guidance), 4) 24 dealers + 3,000+ projects of experience.",
    category: "brand",
    keywords:
      "different,unique,better,why choose,advantage,special,usp,compare you",
  },
  {
    id: "faq-Q7",
    question: "Are you GreenPro certified?",
    answer:
      "Yes—GreenPro certified. Our products meet rigorous sustainability standards. UHPC production uses less energy and panels are recyclable at end of life. Valid for LEED projects.",
    category: "brand",
    keywords:
      "greenpro,green,certified,eco,sustainable,leed,environment,carbon,certification",
  },
  {
    id: "faq-Q8",
    question: "Do you export internationally?",
    answer:
      "Yes—our panels have already traveled internationally. Share the country/city and approximate quantity and we'll handle packaging and shipping guidance.",
    category: "brand",
    keywords: "export,international,abroad,overseas,foreign,outside india,global",
  },
  {
    id: "faq-Q9",
    question: "Do you have a brochure or catalog?",
    answer:
      "We have a comprehensive 61 MB digital catalog—Surfaces by Hey—showcasing every design with real project imagery. Tell us your application (interior/exterior, residential/commercial) and we'll share the most relevant section.",
    category: "brand",
    keywords:
      "brochure,catalog,catalogue,pdf,book,lookbook,designs,images,photos send",
  },
  {
    id: "faq-Q10",
    question: "Can I visit your experience center?",
    answer:
      "Yes—we always encourage visits. Address: Hey Concrete, JPR2+GM9, Pratapura Bypass Link Rd, Bedla, Udaipur, Rajasthan 313011. Timings: 9:30 AM – 8:00 PM (Monday–Saturday). Photos don't do justice to texture—you need to touch it.",
    category: "brand",
    keywords:
      "visit,experience center,showroom,come,see,touch,feel,udaipur,address,location map",
  },
  {
    id: "faq-Q11",
    question: "What are your working hours?",
    answer:
      "9:00 AM – 8:00 PM, Monday to Saturday. Sunday closed. For urgent project questions, drop a message—we understand timelines.",
    category: "brand",
    keywords:
      "working hours,timing,time,open,close,when,monday saturday,sunday,available",
  },
  {
    id: "faq-Q12",
    question: "Who founded Hey Concrete?",
    answer:
      "Hey Concrete is led by Mr. Aseem Bolia, backed by a team of engineers and business professionals obsessed with turning concrete into design-led architecture.",
    category: "brand",
    keywords: "founder,founded,aseem bolia,owner,who started,ceo,head,leadership",
  },
  {
    id: "faq-Q13",
    question: "Do you participate in exhibitions?",
    answer:
      "Yes—we're present at major architecture and design exhibitions across India and internationally. Share your city and we'll connect you with the nearest dealer, experience center, or a completed project to visit.",
    category: "brand",
    keywords:
      "exhibition,expo,fair,event,show,conference,architecture,design event,trade show",
  },
  {
    id: "faq-Q14",
    question: "How can I contact your team?",
    answer:
      "Email: info@heyconcrete.com | Phone: +91 8107719987 | Working hours: 9 AM – 8 PM, Monday to Saturday. We have 24 dealers across India—there's likely someone near you.",
    category: "brand",
    keywords:
      "contact,phone number,email,reach out,call you,whatsapp number,how to reach,contact details,helpline,8107719987,contact karna,kaise contact,number do,email do",
  },

  // ─── B) PRODUCT DISCOVERY (Q15–Q17) ──────────────────────────────────────
  {
    id: "faq-Q15",
    question: "I'm not sure what suits my space—how do we decide?",
    answer:
      "Send us 1 photo of your wall/space + approximate size + your vibe (minimal, earthy, luxury, bold). Within hours we'll shortlist 2–3 options proven to work in spaces like yours. Think of us as your design advisor who also manufactures the product.",
    category: "product",
    keywords:
      "not sure,help choose,which product,suggest,recommend,confused,what to pick,advise",
  },
  {
    id: "faq-Q16",
    question: "Where can Hey Concrete panels and breeze blocks be used?",
    answer:
      "Almost everywhere: feature walls, living rooms, lobbies, facades, balconies, cafes, retail, hotels, offices, partitions and screens. Tell us your space and we'll recommend the safest, most impactful system.",
    category: "product",
    keywords:
      "where use,application,suitable,places,room,area,exterior,interior,commercial,residential",
  },
  {
    id: "faq-Q17",
    question: "Can you share real project photos or videos?",
    answer:
      "Absolutely. Tell us your space type (villa, cafe, facade, office, hotel) and we'll share real-world project references—not renders, not stock images. 3,000+ projects worth of visual proof.",
    category: "product",
    keywords:
      "real photos,project photos,references,examples,portfolio,videos,see work,images,completed",
  },

  // ─── C) WALL PANELS — MATERIAL (Q18–Q47) ────────────────────────────────
  {
    id: "faq-Q18",
    question: "What material are your panels made of?",
    answer:
      "Our panels are made from UHPC (Ultra High Performance Concrete) using our self-developed H-UHPC formula—high-grade cement, quartz sand, alkali-resistant glass fiber, pozzolanic agents, and performance enhancers. Imagine concrete as thin as a tile, as detailed as sculpture, and as tough as a bridge.",
    category: "product",
    keywords:
      "material,made of,uhpc,concrete,composition,formula,ingredients,what is it made",
  },
  {
    id: "faq-Q19",
    question: "How is UHPC different from regular concrete?",
    answer:
      "Regular concrete is M25–M30 grade. Our UHPC is M70+. 3x stronger compression (≥60 MPa), near-zero porosity (water absorption ≤1%, permeability NIL), UV-stable, frost-resistant, chemical-resistant. Enables 10mm thin panels that outperform 50mm stone.",
    category: "product",
    keywords:
      "uhpc difference,regular concrete,m70,strength,compare concrete,why better,technical",
  },
  {
    id: "faq-Q20",
    question: "Are panels suitable for exterior use—rain, heat, sun?",
    answer:
      "Yes—every Hey Concrete panel works interior AND exterior. Same UHPC formula, no difference. Survived Rajasthan's 48°C summers, coastal humidity, and monsoon downpours across 3,000+ projects. Works outdoor.",
    category: "product",
    keywords:
      "exterior,outdoor,outside,rain,weather,sun,heat,waterproof,water,exterior use,balcony,facade",
  },
  {
    id: "faq-Q21",
    question: "Are panels UV stable?",
    answer:
      "100% UV resistant. The grey you choose today will still be the same grey 10 years from now—no fading, no yellowing, no discoloration. UV lab test reports available on request.",
    category: "product",
    keywords:
      "uv,fade,fading,sunlight,color change,yellowing,discolor,uv stable,uv resistant",
  },
  {
    id: "faq-Q22",
    question: "Are panels water-resistant?",
    answer:
      "Yes—water absorption ≤1%, permeability NIL. Water literally has nowhere to go. However, if the wall behind has dampness, treat that first before installation. Panels are water-resistant; your wall needs to be too.",
    category: "product",
    keywords:
      "water resistant,waterproof,moisture,wet,bathroom,pool,rain,water proof,water absorption",
  },
  {
    id: "faq-Q23",
    question: "Are panels fire-resistant?",
    answer:
      "Fire Class A—the highest rating. UHPC is non-combustible with a high melting point. While wood, MDF, and many decorative panels are fire hazards, our panels actually help prevent fire spread. Critical for hotels and high-rises.",
    category: "product",
    keywords:
      "fire,fireproof,flame,combustible,fire resistant,fire safe,fire class,non combustible",
  },
  {
    id: "faq-Q24",
    question: "Are panels termite-proof?",
    answer:
      "Completely. Concrete is naturally unattractive to insects—no termites, no borers, no mold, no mildew. Zero biological risk, zero chemical treatment needed.",
    category: "product",
    keywords:
      "termite,bug,insect,mold,mildew,pest,termite proof,borers,ant,cockroach",
  },
  {
    id: "faq-Q25",
    question: "Do panels have acoustic properties?",
    answer:
      "STC rating of 50—loud sounds are only faintly audible and normal speech cannot be heard through the wall. Excellent for bedrooms, home offices, hotel rooms, and meeting rooms.",
    category: "product",
    keywords:
      "acoustic,sound,noise,stc,soundproof,quiet,noise reduction,sound insulation,stc 50",
  },
  {
    id: "faq-Q26",
    question: "Are panels resistant to chemicals and stains?",
    answer:
      "Yes—factory-sealed with protective water-based sealer and silicate-based treatment resisting stains, aging, and UV. Handles acids, alkalis, and chlorides. Perfect for coastal homes and high-traffic restaurants.",
    category: "product",
    keywords:
      "chemical,stain,resistant,acid,salt,coastal,clean,chemical resistant,stain proof",
  },
  {
    id: "faq-Q27",
    question: "How many designs, colors, and textures do you have?",
    answer:
      "53 products total: 40+ wall panel designs, 12 breeze block designs, Teraline brick cladding. 18 standard color shades across all wall panels. 2 textures: Plain (standard) and Poros (organic crater finish, +10%).",
    category: "product",
    keywords:
      "how many designs,colors,colours,textures,designs available,variety,options,shades,poros",
  },
  {
    id: "faq-Q28",
    question: "Which designs are most popular?",
    answer:
      "Toran, Corner Fold, Serene, Ivy, Dune, and Legato consistently top our charts. The 'best' design depends on your wall size, lighting, and style. Share a photo and we'll recommend what will genuinely look premium in YOUR space.",
    category: "product",
    keywords:
      "popular,best design,trending,most liked,famous,top picks,which design,favorite",
  },
  {
    id: "faq-Q29",
    question: "Do you have panels with integrated lights?",
    answer:
      "Yes—Toran, Fold series (Corner Fold, Wrap Fold, Edge Fold), Recursion, Furrow 2.0, Code 2.0, Curve, Petal, and Crest come with integrated lighting. Soft warm light spills from geometric grooves—transforms the entire mood of a room.",
    category: "product",
    keywords:
      "lights,lighting,integrated,led,backlit,glow,illuminated,light panel,luminous",
  },
  {
    id: "faq-Q30",
    question: "Do you have fluted panels?",
    answer:
      "Absolutely—Furrow, Furrow 2.0, Billow, Ridge, Code, Parallel, and Drape offer stunning vertical/linear grooves. Unlike WPC or MDF fluted panels: ours are UHPC concrete—fireproof, waterproof, UV-stable, designed to last decades.",
    category: "product",
    keywords:
      "fluted,flute,grooves,linear,vertical lines,ribbed,stripe,groove panel,fluted design",
  },
  {
    id: "faq-Q31",
    question: "Can panels be customized?",
    answer:
      "Yes: Custom color (+10% on standard rate), Custom texture/pattern (share reference, evaluate feasibility), Full custom design (MOQ ~1,500 sqft), Logo/branding embossed into panels (for reception walls, retail flagships).",
    category: "product",
    keywords:
      "custom,customize,bespoke,logo,branding,personalize,custom color,custom design,tailor",
  },
  {
    id: "faq-Q32",
    question: "Can you develop a texture from a reference photo?",
    answer:
      "Yes—share the reference image and tell us where it's going (interior/exterior, wall size). We'll assess feasibility and find the cleanest execution path. You could have a surface that exists nowhere else in the world.",
    category: "product",
    keywords:
      "reference photo,texture from photo,custom texture,copy design,replicate,match",
  },
  {
    id: "faq-Q33",
    question: "What are standard panel sizes?",
    answer:
      "Sizes vary by design—from compact formats (6×6 inches) to large statement panels (up to ~9 ft × 3 ft in select designs). Size tolerance ±2 mm.",
    category: "product",
    keywords:
      "size,dimension,panel size,how big,large,small,formats,measurements,sqft panel",
  },
  {
    id: "faq-Q34",
    question: "What is panel thickness?",
    answer:
      "Base thickness is just 10–12 mm—thinner than most tiles. Deeper 3D designs can reach 35–50 mm. Thickness tolerance ±1.5–2 mm.",
    category: "product",
    keywords:
      "thickness,thin,depth,3d depth,how thick,10mm,12mm,panel depth,weight bearing",
  },
  {
    id: "faq-Q35",
    question: "How heavy are the panels?",
    answer:
      "Approximately 2–2.5 kg per sqft for a 10mm panel—same as a ceramic tile and half the weight of natural stone (5–8 kg/sqft). Easier handling, faster installation, less structural load.",
    category: "product",
    keywords:
      "weight,heavy,how heavy,kg,light,load,structural load,transport easy,carry",
  },
  {
    id: "faq-Q36",
    question: "Can panels bend or curve?",
    answer:
      "Solid UHPC panels don't bend—that means no warping like wood or MDF. For curved walls, we handle it through smart layout strategy and design selection that creates the illusion of flow.",
    category: "product",
    keywords:
      "bend,curve,curved wall,round wall,arch,circular,flexible,warping,radius",
  },
  {
    id: "faq-Q37",
    question: "Can panels be painted?",
    answer:
      "Yes, it's concrete so it accepts paint. But you won't want to—our color is integral (full-body pigmentation through the panel, not just surface). No painting needed, no repainting ever. The color is part of the material.",
    category: "product",
    keywords: "paint,painted,color change,repaint,paint over,color coat,pigment",
  },
  {
    id: "faq-Q38",
    question: "Why do concrete panels have slight color variation?",
    answer:
      "Because concrete is a living, cast material—not a factory-printed laminate. Minor variation is natural and gives each wall its unique character. We control variation tightly through our process and reorders remain consistent.",
    category: "product",
    keywords:
      "color variation,shade difference,batch difference,inconsistent color,variation,mismatch",
  },
  {
    id: "faq-Q39",
    question: "Will the color match if I reorder after months?",
    answer:
      "Yes—color consistency is a key strength. We recommend confirming the shade code and texture when reordering, but our clients regularly do top-ups and extensions without any visible mismatch.",
    category: "product",
    keywords:
      "reorder,color match,order again,shade match,second order,batch match,consistency",
  },
  {
    id: "faq-Q40",
    question: "Why do plain panels have tiny pinholes?",
    answer:
      "That's the authentic fingerprint of cast concrete—like grain in real wood or veining in marble. Small surface pinholes occur from trapped air during casting. They're an inherent feature, not a defect. Many architects specifically request this look.",
    category: "product",
    keywords:
      "pinholes,pores,tiny holes,bubbles,surface holes,defect,dots,pinhole,air pockets",
  },
  {
    id: "faq-Q41",
    question: "What about hairline cracks?",
    answer:
      "Hairline cracks are natural in concrete—they don't affect structural integrity or water resistance. These micro-cracks may develop over time and are usually invisible without a magnifying glass. Same as centuries-old concrete structures. Visible transit cracks: report within 7 days.",
    category: "product",
    keywords:
      "hairline crack,crack,cracking,micro crack,fracture,split,damage,break",
  },
  {
    id: "faq-Q42",
    question: "How long do panels last?",
    answer:
      "With correct installation, UHPC panels can last 100+ years. We back it with a 5-year warranty against manufacturing defects. You're buying a permanent upgrade—not a finish that needs replacing in 5–10 years.",
    category: "product",
    keywords:
      "last,lifespan,durable,long lasting,kitne saal,how many years,warranty,guarantee,life,toot jayega,how durable,long life,permanent",
  },
  {
    id: "faq-Q43",
    question: "How do I clean and maintain the panels?",
    answer:
      "Mild soap + water with a soft cotton cloth. That's it. No special chemicals, no annual sealing, no repolishing. Use feather dusters for everyday cleaning. Compare this to stone (annual resealing) or wood (termite treatment)—it's maintenance-free.",
    category: "product",
    keywords:
      "clean,cleaning,maintain,maintenance,care,soap,wash,how to clean,upkeep,care tips",
  },
  {
    id: "faq-Q44",
    question: "Can switchboards and fittings be installed on panels?",
    answer:
      "Yes—panels can be precision-cut on-site for switchboards, outlets, and fittings using a zero-chipping diamond blade.",
    category: "installation",
    keywords:
      "switchboard,electrical,outlet,fitting,socket,cut for,switch,electric point,box",
  },
  {
    id: "faq-Q45",
    question: "Can panels be cut into custom shapes?",
    answer:
      "Yes—on-site with a plunge-cut saw with zero-chipping diamond blade. Cut from the back surface (dry cutting only). Smooth edges with a 60-grade grinding wheel. We provide cutting best practices with every project.",
    category: "installation",
    keywords:
      "cut,cutting,custom shape,trim,resize,cut panel,diamond blade,saw,on site cut",
  },
  {
    id: "faq-Q46",
    question: "Do panels need spacing between them?",
    answer:
      "Most panels need 2–5 mm spacing—the joint creates clean shadow lines that make the wall look intentional. Designs with no spacing: Code, Parametric, Delta, Furrow, Drape, Grid, Matrix, Pinewood, Ruggedwood, Trinity, Wedge, Recursion, Tetra.",
    category: "installation",
    keywords:
      "spacing,space,gap,joint,grout gap,between panels,how much gap,mm gap,seamless",
  },
  {
    id: "faq-Q47",
    question: "Can panels be reused after removal?",
    answer:
      "No—panels are permanently bonded with adhesive and may break during removal. This is why we invest heavily in layout planning upfront. Get it right the first time—you'll never need to remove them.",
    category: "installation",
    keywords:
      "reuse,remove,removable,uninstall,take off,second use,relocation,removed,replace",
  },

  // ─── D) INSTALLATION & EXECUTION (Q48–Q64) ──────────────────────────────
  {
    id: "faq-Q48",
    question: "Who installs the panels?",
    answer:
      "Two options: 1) Our company-approved contractors, available pan-India (done this hundreds of times), or 2) Your own tile/stone mason—we'll train them personally. Installation: ~₹150–200/sqft (labour + adhesive), varying by city, height, and design.",
    category: "installation",
    keywords:
      "who installs,installer,contractor,mason,fitter,who does installation,my contractor,labour",
  },
  {
    id: "faq-Q49",
    question: "How fast is installation?",
    answer:
      "Typically ~80 sqft per day per mason, depending on design complexity and wall readiness. A 10×10 feature wall can be done in a single day.",
    category: "installation",
    keywords:
      "how fast install,installation time,how long installation,speed,days,quick,fast install",
  },
  {
    id: "faq-Q50",
    question: "Do you provide installation drawings and layout help?",
    answer:
      "Yes—we strongly recommend it. Share wall dimensions and we'll help with drawings, panel placement strategy, and 3D visualization so everyone's aligned before the first panel goes up.",
    category: "installation",
    keywords:
      "drawing,layout,3d,plan,visualization,design layout,before installation,blueprint,render",
  },
  {
    id: "faq-Q51",
    question: "How should the wall be prepared before installation?",
    answer:
      "Wall must be damp-proof, clean, dry, dust-free, and structurally solid. Perfectly vertical (max concavity 3mm per tile length). Remove ALL paint and POP completely. Test plaster strength with a mallet. Waterproof damp walls first. Sprinkle water on plastered walls right before applying adhesive.",
    category: "installation",
    keywords:
      "wall prep,preparation,before install,base,plaster,paint removal,pop,wall ready,substrate",
  },
  {
    id: "faq-Q52",
    question: "Can panels be installed on painted or POP walls?",
    answer:
      "Not directly. Paint and POP create a weak layer between wall and adhesive. It MUST be completely removed (not just scratched). Applies to plastered walls, ply, and cement board surfaces.",
    category: "installation",
    keywords:
      "painted wall,pop wall,paint wall,plaster wall,gypsum,existing paint,remove paint",
  },
  {
    id: "faq-Q53",
    question: "Can panels be installed on gypsum board or partitions?",
    answer:
      "Yes—on gypsum/cement board with PU-based adhesive and proper base verification. Done successfully on many commercial interiors. Ensure the board is properly anchored.",
    category: "installation",
    keywords:
      "gypsum,gypsum board,partition,drywall,false wall,ceraboard,cement board,pu adhesive",
  },
  {
    id: "faq-Q54",
    question: "What if my wall has dampness?",
    answer:
      "Our panels are water-resistant, but dampness in the wall behind will destroy the adhesive bond over time. Waterproof the wall first, or use a metal frame + cement board system for severe cases. Fix the foundation first.",
    category: "installation",
    keywords:
      "damp,dampness,seepage,wet wall,moisture wall,leakage,water damage,damp proof",
  },
  {
    id: "faq-Q55",
    question: "What adhesive should I use?",
    answer:
      "For plastered walls (interior): Kerakoll Bioflex or MYK Laticrete 325. For plastered walls (exterior): MYK Laticrete 335 or 345. For plywood/MDF/cement sheets/ceraboard: PU-based adhesive like Kerakoll Superflex, MYK Laticrete PUA 212, or Mapei Keralastic.",
    category: "installation",
    keywords:
      "adhesive,glue,what glue,kerakoll,laticrete,pu adhesive,cement adhesive,bond,paste",
  },
  {
    id: "faq-Q56",
    question: "How are panels positioned on the wall?",
    answer:
      "Apply adhesive on BOTH wall AND panel back using notched trowel. Trowel lines should be perpendicular. Place from bottom edge, pressing upward. Press edges first, then across the surface. Fix with rubber mallet. Check alignment with leveller.",
    category: "installation",
    keywords:
      "how to install,positioning,placement,step by step install,fix panel,rubber mallet,level",
  },
  {
    id: "faq-Q57",
    question: "What about grouting between panels?",
    answer:
      "Use ONLY high-quality cementitious sanded tile grout. DO NOT USE epoxy-based grouts. Mask panel edges with 2\" non-marking masking tape (ABRO). Fill gaps evenly (at least 3mm deep). Remove tape immediately after applying grout.",
    category: "installation",
    keywords:
      "grout,grouting,joint fill,gap fill,tile grout,epoxy,masking tape,grout color",
  },
  {
    id: "faq-Q58",
    question: "Can panels be installed on ceilings?",
    answer:
      "We do NOT recommend ceiling installation due to gravity and safety risk. If absolutely required, consult a structural engineer and design a proper mechanical fixing system.",
    category: "installation",
    keywords: "ceiling,roof,above,overhead,ceiling install,top,upward,sky",
  },
  {
    id: "faq-Q59",
    question: "What about installation on high walls (above 20 feet)?",
    answer:
      "For walls above 20 feet, we recommend L-clamps for additional mechanical support—non-negotiable for safety. For very tall facades, we can guide and supervise the entire process.",
    category: "installation",
    keywords:
      "high wall,tall wall,above 20 feet,tall,height,l clamp,mechanical support,double height",
  },
  {
    id: "faq-Q60",
    question: "What installation temperature is required?",
    answer:
      "Between 5°C and 40°C. In extreme heat, adhesive cures too fast; in extreme cold, it doesn't bond properly. Most of India falls comfortably in this range year-round.",
    category: "installation",
    keywords:
      "temperature,weather,cold,hot,heat,winter,summer,temperature range,climate,season",
  },
  {
    id: "faq-Q61",
    question: "What if panels arrive damaged?",
    answer:
      "First: record a video during unloading (mandatory for claims). Second: notify us within 7 days of delivery with photos/video of any chipping or breakage. We'll assess and support replacements via a fair process.",
    category: "delivery",
    keywords:
      "damaged,arrive damaged,broken,chip,cracked on arrival,damage claim,broken panel,complaint",
  },
  {
    id: "faq-Q62",
    question: "How should I handle and store panels?",
    answer:
      "Always lift from edges—never drag or lay flat. Move vertically with longer edge down. Under 1,500mm: 2 people. Over 1,500mm: 3 people. Store vertically on edges, perpendicular to ground. Place on wooden planks. Store indoors or under cover.",
    category: "installation",
    keywords: "handle,store,storage,stack,carry,transport on site,vertical,wooden plank",
  },
  {
    id: "faq-Q63",
    question: "What tools are needed for installation?",
    answer:
      "Adhesive mixer, notched trowel, rubber mallet, level/ruler, spacers, safety goggles, gloves, 2-inch ABRO masking tape, mixing bucket, zero-chipping diamond blade (for cutting), 60-grade grinding wheel, tile levelling system kit.",
    category: "installation",
    keywords: "tools,equipment,what tools,required tools,installation tools,diamond blade,mallet",
  },
  {
    id: "faq-Q64",
    question: "Any post-installation care tips?",
    answer:
      "Clean panels with soap-water immediately after installation. Cover wall with plastic sheets during remaining construction. NEVER apply tape directly on panel surfaces. Install panels AFTER final floor polishing. Complete wall painting BEFORE panel installation.",
    category: "installation",
    keywords:
      "after install,post installation,care,protect,construction site,cover,finishing tips",
  },

  // ─── E) TECHNICAL SPECIFICATIONS (Q65–Q70) ──────────────────────────────
  {
    id: "faq-Q65",
    question: "What are the detailed technical specifications?",
    answer:
      "Compressive Strength ≥60 MPa, Flexural Strength ≥6.9 MPa, Water Absorption ≤1%, Surface Hardness Mohs Class 8 (harder than granite), Fire Classification Class A, Sound Transmission STC 50, Permeability NIL, Frost Resistant, VOC 0.4 mg/m³. Lab-verified facts.",
    category: "product",
    keywords:
      "specifications,specs,technical,mpa,mohs,strength,data sheet,lab test,technical sheet",
  },
  {
    id: "faq-Q66",
    question: "What is STC 50 and why should I care?",
    answer:
      "STC 50 means loud sounds become faint whispers and normal conversation is completely inaudible through the wall. Dramatically improves quality of life in bedrooms, home offices, hotel rooms, and meeting rooms—from your wall cladding, not an add-on.",
    category: "product",
    keywords: "stc 50,stc,sound transmission,acoustic rating,noise level,soundproofing detail",
  },
  {
    id: "faq-Q67",
    question: "What surface finish and sealing is applied?",
    answer:
      "Finish: Matte (natural concrete look). Textures: Plain and Poros. Sealer: Protective water-based sealer + silicate-based surface treatment applied via airless spray. Creates a shield against stains, aging, and UV. Breathable, invisible protection.",
    category: "product",
    keywords:
      "finish,sealing,sealed,matte,poros,texture,surface treatment,sealer,protective coating",
  },
  {
    id: "faq-Q68",
    question: "What is the chemical composition?",
    answer:
      "Carefully selected cement, fine and coarse aggregates, high-performance fibers, pozzolanic agents (flyash and GGBS), and advanced chemical admixtures. Engineered for low porosity, high strength, and superior durability.",
    category: "product",
    keywords:
      "chemical,composition,ingredient,flyash,ggbs,fiber,cement,aggregate,admixture",
  },
  {
    id: "faq-Q69",
    question: "Do you have a warranty?",
    answer:
      "5-year warranty against manufacturing defects. The actual lifespan is 30+ years with minimal maintenance (theoretically 100+ years). We warranty for 5 years because anything beyond depends on installation quality and site conditions—fair to both sides.",
    category: "product",
    keywords:
      "warranty,guarantee,how long warranty,5 year,coverage,claim,defect warranty,what covered",
  },
  {
    id: "faq-Q70",
    question: "Where can the panels be applied?",
    answer:
      "Residential (homes, apartments, villas), Commercial (offices, co-working, retail), Hospitality (hotels, restaurants, cafes, bars), Architectural features (facades, accent walls, lobbies), Industrial (warehouses, showrooms). If there's a wall, we can make it extraordinary.",
    category: "product",
    keywords:
      "where apply,applications,uses,hotel,villa,office,restaurant,commercial,residential,lobby",
  },

  // ─── F) BREEZE BLOCKS (Q71–Q82) ──────────────────────────────────────────
  {
    id: "faq-Q71",
    question: "What are breeze blocks and why are they special?",
    answer:
      "Breeze blocks are decorative concrete screens (jali partitions) made from M-50 grade fibre-reinforced concrete. They solve three problems at once: airflow, privacy, and stunning aesthetics. Perfect for cafes, courtyards, hotel lobbies, and balconies.",
    category: "product",
    keywords:
      "breeze blocks,jali,partition,screen,decorative,concrete screen,what is breeze,block",
  },
  {
    id: "faq-Q72",
    question: "What sizes are available for breeze blocks?",
    answer:
      "200 × 200 × 60 mm (most popular) and 300 × 200 mm (select designs). Compact enough for intricate patterns, large enough to cover real walls efficiently.",
    category: "product",
    keywords:
      "breeze block size,block size,200x200,300x200,dimensions,block dimensions,size breeze",
  },
  {
    id: "faq-Q73",
    question: "Are breeze blocks structural or load-bearing?",
    answer:
      "No—they're decorative partitions and screens, not structural walls. They need appropriate framework support based on height. Think of them as the jewelry of architecture.",
    category: "product",
    keywords:
      "structural,load bearing,weight bearing,partition wall,support,framework,structural breeze",
  },
  {
    id: "faq-Q74",
    question: "Where are breeze blocks used best?",
    answer:
      "Balconies, courtyards, staircases, cafe facades, reception backdrops, garden walls, pooja room partitions, and room dividers. Most photographed element in hotel and restaurant spaces.",
    category: "product",
    keywords:
      "breeze block use,where use breeze,balcony,courtyard,cafe partition,pooja room,divider",
  },
  {
    id: "faq-Q75",
    question: "Can breeze blocks be backlit?",
    answer:
      "Yes—when you backlight a breeze block wall, the pattern comes alive, casting geometric shadows that shift through the day. Signature design moments in hospitality and retail. Multiple social media clients have gained thousands of posts from backlit walls.",
    category: "product",
    keywords: "backlit,backlight,light behind,shadow,glow breeze,illuminated block,led breeze",
  },
  {
    id: "faq-Q76",
    question: "How many breeze block patterns are available?",
    answer:
      "12 designs currently—each with a distinct personality. Tell us the vibe you're going for (geometric, organic, traditional, minimal) and we'll shortlist the top 2–3 options in minutes.",
    category: "product",
    keywords: "breeze patterns,how many breeze,12 designs,pattern variety,block designs",
  },
  {
    id: "faq-Q77",
    question: "What colors are available for breeze blocks?",
    answer:
      "Standard: White (most popular), Orange, and Grey. Custom color available with ~500 sqft minimum order. White catches light beautifully and works with any design style.",
    category: "product",
    keywords:
      "breeze color,block color,white orange grey,white breeze,color options breeze,custom color block",
  },
  {
    id: "faq-Q78",
    question: "How are breeze blocks installed?",
    answer:
      "Up to ~5 ft: usually no framework needed. 5–7 ft: horizontal support recommended. 8–10 ft: vertical support required. Spacing: 5–8 mm between blocks. We'll advise based on your wall height, exposure, and wind load.",
    category: "installation",
    keywords:
      "install breeze,breeze installation,framework,how to install breeze,height support,block install",
  },
  {
    id: "faq-Q79",
    question: "Do you provide installation drawings for breeze blocks?",
    answer:
      "Yes—share wall dimensions and we'll create layout drawings showing exact block placement, framework requirements, and spacing. Eliminates guesswork on-site.",
    category: "installation",
    keywords: "breeze drawing,layout breeze,block layout,drawing block,framework drawing",
  },
  {
    id: "faq-Q80",
    question: "Are breeze blocks good for ventilation?",
    answer:
      "That's their superpower. Open patterns allow natural cross-ventilation while maintaining visual privacy—cooler spaces, lower AC bills, and a design element that actually makes your building more comfortable.",
    category: "product",
    keywords:
      "ventilation,air,airflow,cross ventilation,ac,cool,breeze ventilation,natural air",
  },
  {
    id: "faq-Q81",
    question: "What is the lead time for breeze blocks?",
    answer:
      "2–3 weeks from confirmation and advance payment. Fast enough for most project timelines, but we always recommend ordering early—especially for custom colors or large quantities.",
    category: "delivery",
    keywords:
      "breeze delivery,breeze lead time,when deliver block,2 weeks breeze,dispatch breeze",
  },
  {
    id: "faq-Q82",
    question: "What is the spacing recommendation for breeze blocks?",
    answer:
      "5–8 mm both horizontally and vertically. This gap is grouted and becomes part of the design grid, giving the wall that clean, intentional look.",
    category: "installation",
    keywords: "breeze spacing,block gap,gap breeze,5mm,8mm,breeze grout,how much space block",
  },

  // ─── G) TERALINE — BRICK CLADDING (Q83–Q85) ─────────────────────────────
  {
    id: "faq-Q83",
    question: "What is Teraline?",
    answer:
      "Teraline is our brick cladding line—thin, lightweight brick-format panels giving the warmth of exposed brick without the weight, mess, or structural concerns. Perfect for accent walls, restaurant interiors, and heritage-inspired facades.",
    category: "product",
    keywords:
      "teraline,brick cladding,brick look,exposed brick,heritage,brick wall,brick panel",
  },
  {
    id: "faq-Q84",
    question: "What sizes are available for Teraline?",
    answer:
      "225 × 75 mm (standard brick proportion) and 225 × 37.5 mm (slim format for a more refined look).",
    category: "product",
    keywords: "teraline size,brick size,225x75,slim brick,brick dimension,teraline dimension",
  },
  {
    id: "faq-Q85",
    question: "What is the price range for Teraline?",
    answer:
      "₹125 to ₹200 per sqft depending on design and color. One of the most affordable ways to get a premium surface finish.",
    category: "pricing",
    keywords:
      "teraline price,brick price,brick cost,teraline cost,brick cladding price,125 200",
  },

  // ─── H) PRICING, QUOTES & PAYMENTS (Q86–Q97) ────────────────────────────
  {
    id: "faq-Q86",
    question: "What is the pricing for wall panels?",
    answer:
      "Wall panels range from ₹320 to ₹1,010 per sqft + GST. Poros texture: +10%. Custom color: +10%. Pricing effective January 2026. Transport is extra (on actuals).",
    category: "pricing",
    keywords:
      "price,pricing,cost,rate,kitna,how much,sqft rate,per sqft,panel price,wall panel cost,kitne ka,kya rate hai,price list,rate list,how much does it cost",
  },
  {
    id: "faq-Q87",
    question: "How do I request a quotation?",
    answer:
      "Five details needed: City, Product (panels/breeze blocks/Teraline), Area in sqft, Interior or exterior, Timeline. Within working hours you'll receive a proper quote with complete breakup—not a generic price list.",
    category: "pricing",
    keywords:
      "quotation,quote,estimate,price request,how to get price,quote request,get quote",
  },
  {
    id: "faq-Q88",
    question: "Do you give detailed price breakups?",
    answer:
      "Yes—product cost, customization surcharge (if any), GST, packaging, and transport all clearly separated. No hidden charges, no surprises. Transparency is how we've built trust across 3,000+ projects.",
    category: "pricing",
    keywords:
      "price breakup,detailed quote,hidden charges,transparent,gst included,all in cost",
  },
  {
    id: "faq-Q89",
    question: "Do you offer bulk or volume discounts?",
    answer:
      "Yes—orders of 150+ sqft qualify for additional discounts, available through our sales team. Volume and repeat orders get preferred pricing. Architects and contractors can ask about partner pricing.",
    category: "pricing",
    keywords:
      "discount,bulk,volume,150 sqft,bulk discount,partner pricing,architect discount,more sqft",
  },
  {
    id: "faq-Q90",
    question: "What are the payment terms?",
    answer:
      "50% advance to start production + 50% before dispatch. Simple, fair, and standard in the industry. Your advance sets the production wheels in motion immediately.",
    category: "pricing",
    keywords:
      "payment,advance,terms,50 percent,payment terms,how to pay,advance payment,dispatch payment",
  },
  {
    id: "faq-Q91",
    question: "Is GST applicable?",
    answer:
      "Yes—GST as per government norms on all products.",
    category: "pricing",
    keywords: "gst,tax,igst,cgst,sgst,inclusive,exclusive,plus gst,government tax",
  },
  {
    id: "faq-Q92",
    question: "Is pricing the same across India?",
    answer:
      "Base pricing (ex-factory, Udaipur) is consistent nationwide. The only variable is transport and logistics, depending on destination and order size. Always a clear total including delivery—no last-minute additions.",
    category: "pricing",
    keywords:
      "same price,india price,consistent,pan india price,location price,different city price",
  },
  {
    id: "faq-Q93",
    question: "Is there a minimum order quantity (MOQ)?",
    answer:
      "Standard products: No MOQ—even a small feature wall is welcome. Custom color: +10% surcharge (panels) or ~500 sqft MOQ (breeze blocks). Full custom design: ~1,500 sqft MOQ.",
    category: "pricing",
    keywords:
      "moq,minimum order,how much minimum,small order,no minimum,minimum quantity,low quantity",
  },
  {
    id: "faq-Q94",
    question: "I'm getting similar panels cheaper elsewhere—why choose Hey Concrete?",
    answer:
      "Cheaper alternatives often have: color fading within 1–2 years, patchy finishes, panels cracking in rain/heat, zero installation support, no warranty. Hey Concrete gives: genuine UHPC performance, GreenPro certification, patented exclusive designs, 5-year warranty, and a team that stays with you from order to installation.",
    category: "comparison",
    keywords:
      "cheaper,competitor,less expensive,why not other,why you,better than,compare cheaper",
  },
  {
    id: "faq-Q95",
    question: "Why are Hey Concrete panels priced higher than local options?",
    answer:
      "Because they're not ordinary concrete sheets—designer UHPC panels with precision molds, full-body pigmentation (not surface paint), controlled curing, triple quality checks, factory sealing, and end-to-end execution support. The price reflects the difference—and so does the result on your wall.",
    category: "pricing",
    keywords:
      "why expensive,high price,costly,premium price,local vs hey concrete,justify price",
  },
  {
    id: "faq-Q96",
    question: "What is the installation cost?",
    answer:
      "Tentatively ₹150–200 per sqft for labour + adhesive, varying by city, wall height, and panel design. This is separate from product cost.",
    category: "installation",
    keywords:
      "installation cost,install cost,labour cost,labor cost,fitting charge,lagana cost,lagwana,installation charges,how much install,installation price,contractor cost,kitna lagega install,labour charges,fitting cost,install karna,lagane ka kharcha,install kitna",
  },
  {
    id: "faq-Q97",
    question: "What is the estimated total cost for a 10×10 ft wall?",
    answer:
      "For a 100 sqft wall: product cost ~₹40,000 to ₹90,000 depending on design + GST + installation ₹15,000–20,000 + transport. Similar cost to premium wallpaper—but this lasts a lifetime.",
    category: "pricing",
    keywords:
      "100 sqft cost,10x10 wall,total cost estimate,full cost,all in price,wall total budget",
  },

  // ─── I) LOGISTICS, DELIVERY & PACKAGING (Q98–Q106) ──────────────────────
  {
    id: "faq-Q98",
    question: "What is the delivery timeline?",
    answer:
      "Wall panels: 2–4 weeks after design confirmation + advance payment. Breeze blocks: 2–3 weeks. Depends on design, quantity, and customization. Finalize early—popular designs sometimes have longer queues.",
    category: "delivery",
    keywords:
      "delivery,deliver,timeline,how long,dispatch,ship,weeks,kitne din,kab milega,delivery time,kitne time mein,when will i get,shipping time,order delivery",
  },
  {
    id: "faq-Q99",
    question: "Is transportation included in pricing?",
    answer:
      "Transport is charged separately (ex-factory pricing from Udaipur). The cost depends on destination and volume. We'll include the transport estimate in your quote.",
    category: "delivery",
    keywords:
      "transport,shipping cost,delivery charge,included,freight,logistics cost,transport included",
  },
  {
    id: "faq-Q100",
    question: "How are products packed for transit?",
    answer:
      "5-ply corrugated boxes + bubble wrap + foam cushioning + wooden crating where required. Built for Indian roads from Delhi to Kanyakumari. Your panels arrive the way they left our factory.",
    category: "delivery",
    keywords:
      "packing,packaging,how packed,bubble wrap,corrugated,crating,transit safe,packed",
  },
  {
    id: "faq-Q101",
    question: "Are deliveries insured?",
    answer:
      "Insurance is available through our logistics partners and can be arranged based on your requirement. For high-value or long-distance orders, we recommend it for complete peace of mind.",
    category: "delivery",
    keywords: "insurance,insured,transit insurance,delivery insurance,claim,loss",
  },
  {
    id: "faq-Q102",
    question: "How do I track my order?",
    answer:
      "We share transporter details and tracking information once dispatched. You'll know exactly where your panels are and when they'll arrive.",
    category: "delivery",
    keywords: "track,tracking,order status,where is my order,dispatch update,follow shipment",
  },
  {
    id: "faq-Q103",
    question: "Can I pick up from your factory?",
    answer:
      "Yes—self-pickup is possible with prior coordination from our Udaipur facility. Many local clients and dealers prefer this. Everything will be packed and ready when you arrive.",
    category: "delivery",
    keywords: "self pickup,pick up,collect,factory pickup,udaipur pickup,collect myself",
  },
  {
    id: "faq-Q104",
    question: "Can you deliver to multiple sites?",
    answer:
      "Yes—split dispatch can be arranged if planned upfront. Perfect for architects and builders managing multiple projects simultaneously.",
    category: "delivery",
    keywords:
      "multiple sites,split delivery,two locations,multiple locations,different site,split dispatch",
  },
  {
    id: "faq-Q105",
    question: "What about unloading at site?",
    answer:
      "Unloading is managed at site by the client's team. Always have at least 2 people per box, record a video of the entire unloading process (mandatory for damage claims), and handle with care.",
    category: "delivery",
    keywords: "unloading,who unloads,delivery unload,at site,unload help,site team",
  },
  {
    id: "faq-Q106",
    question: "What should I do immediately upon receiving delivery?",
    answer:
      "Record a complete video of unloading (start to finish). Open boxes gently. Don't let panels touch each other during unboxing. Store vertically. Report any chipping or breakage within 7 days with photos/video.",
    category: "delivery",
    keywords:
      "on delivery,when receive,unbox,delivery checklist,first step,video record,checklist",
  },

  // ─── J) COMPETITOR COMPARISONS (Q107–Q109) ───────────────────────────────
  {
    id: "faq-Q107",
    question: "How do Hey Concrete panels compare to Wood / MDF / HDMR?",
    answer:
      "Hey Concrete UHPC vs Wood/MDF: 2x longer lifespan (30+ vs 5–10 years), fireproof (Class A vs combustible), fully water-resistant (vs absorbs moisture), UV-stable (vs fades), termite-proof (vs termite-prone). Similar or lower total cost over lifetime. Wood is a fire hazard and degrades—UHPC doesn't.",
    category: "comparison",
    keywords:
      "vs wood,wood vs,mdf vs,hdmr,compare wood,wood comparison,better than wood,wood alternative",
  },
  {
    id: "faq-Q108",
    question: "How do Hey Concrete panels compare to Stone / CNC Stone?",
    answer:
      "Hey Concrete vs Stone: Flexural strength 12–15 MPa vs 3–5 MPa, weight 2.5 kg/sqft vs 5–8 kg/sqft, repairable on-site vs must replace entire stone, no staining vs prone to staining, cost ₹40K–90K/100sqft vs ₹1.5L–4L/100sqft. UHPC is 1/3 to 1/4 the cost of stone.",
    category: "comparison",
    keywords:
      "vs stone,stone vs,granite vs,marble vs,cnc stone,compare stone,stone comparison,vs marble",
  },
  {
    id: "faq-Q109",
    question: "How do Hey Concrete panels compare to GFRC / GRC?",
    answer:
      "UHPC vs GFRC/GRC: 2x stronger (M70+ vs M30–M40), lighter (2.5 vs 4–6 kg/sqft), longer lifespan (30+ vs 10–15 years), 100% UV-stable, 40+ designs vs flat/simple cast panels. GFRC is the old generation—UHPC is the next.",
    category: "comparison",
    keywords: "gfrc,grc,glass fiber,precast,compare gfrc,vs grc,better than gfrc,uhpc vs gfrc",
  },

  // ─── K) DEALERSHIP & FRANCHISE (Q110–Q119) ───────────────────────────────
  {
    id: "faq-Q110",
    question: "Do you offer dealership or franchise opportunities?",
    answer:
      "Yes—Hey Concrete is actively expanding with 24 dealers across India (as of Feb 2026). The designer concrete surface category is still nascent in India—early movers get the biggest advantage. If you have retail space and passion for premium materials, contact us.",
    category: "dealership",
    keywords:
      "dealership,franchise,dealer,distributor,business opportunity,partnership,become dealer",
  },
  {
    id: "faq-Q111",
    question: "What showroom area is recommended for dealership?",
    answer:
      "1,200–1,500 sqft for maximum display impact. The texture and scale of our panels need physical space to shine. The showroom becomes your most powerful sales tool.",
    category: "dealership",
    keywords:
      "showroom size,display area,dealership showroom,how big showroom,space needed,sqft showroom",
  },
  {
    id: "faq-Q112",
    question: "Do you offer territory exclusivity for dealers?",
    answer:
      "Yes—territory protection is offered based on market potential and your commitment level. You're not competing with another Hey Concrete dealer in your area.",
    category: "dealership",
    keywords:
      "exclusivity,exclusive territory,exclusive dealer,area protection,territory,exclusive area",
  },
  {
    id: "faq-Q113",
    question: "Is stock investment required for dealership?",
    answer:
      "No stock investment is mandatory to start. This significantly lowers your entry risk while giving you access to a premium product portfolio. We produce to order—zero dead inventory on your end.",
    category: "dealership",
    keywords:
      "stock investment,investment required,capital,upfront cost,dealer investment,no stock",
  },
  {
    id: "faq-Q114",
    question: "What support do you provide to dealers?",
    answer:
      "Training, display planning, marketing assets, sales collateral, project references, and ongoing sales support. You're not just getting a product to sell—you're getting a partnership invested in your success.",
    category: "dealership",
    keywords: "dealer support,training dealer,marketing support,what help,dealer benefits",
  },
  {
    id: "faq-Q115",
    question: "Do you train dealer staff?",
    answer:
      "Yes—comprehensive onboarding training plus periodic refreshers. Your team will know the material, designs, installation process, and how to sell surfaces like a consultant.",
    category: "dealership",
    keywords: "staff training,dealer training,onboarding,product training,how to sell",
  },
  {
    id: "faq-Q116",
    question: "How long does it take to set up a dealership?",
    answer:
      "Typically 6–8 weeks from agreement to launch, depending on showroom readiness. We'll guide the display design to ensure your showroom makes the same 'wow' impression as our experience center.",
    category: "dealership",
    keywords:
      "setup time,how long setup,dealership timeline,launch time,when start,6 weeks,8 weeks",
  },
  {
    id: "faq-Q117",
    question: "Is there special dealer pricing?",
    answer:
      "Yes—exclusive dealer pricing and performance-based incentives that make the economics work well for both sides.",
    category: "dealership",
    keywords:
      "dealer price,dealer discount,special pricing,dealer margin,profit margin,incentive",
  },
  {
    id: "faq-Q118",
    question: "What happens if dealership targets aren't met?",
    answer:
      "We support first—more training, better marketing, joint site visits. We don't expect overnight magic. But continued underperformance over time may affect territory exclusivity.",
    category: "dealership",
    keywords: "target,missed target,if not meet,performance,underperform,sales target",
  },
  {
    id: "faq-Q119",
    question: "How do I apply for a dealership?",
    answer:
      "Email info@heyconcrete.com or call +91 8107719987 with your city, proposed showroom location, and a brief background. Our business development team will take it from there. The best territories are going fast.",
    category: "dealership",
    keywords:
      "apply dealer,how apply,dealership application,contact for dealer,apply franchise,start dealership",
  },
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "by",
  "concrete",
  "does",
  "for",
  "from",
  "has",
  "have",
  "hey",
  "how",
  "in",
  "is",
  "it",
  "many",
  "of",
  "on",
  "or",
  "the",
  "their",
  "there",
  "they",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with"
]);

const DOMAIN_TERMS = [
  "greenpro",
  "h-uhpc",
  "wall panels",
  "wall murals",
  "breeze blocks",
  "brick cladding",
  "refund",
  "shipping",
  "installation",
  "custom",
  "bespoke",
  "mumbai",
  "jaipur",
  "hyderabad",
  "chennai",
  "gurgaon",
  "ahmedabad",
  "raipur",
  "bengaluru",
  "kochi",
  "pune"
];

function slugifyQuestion(question: string) {
  return question
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferCategory(question: string) {
  const normalized = question.toLowerCase();

  if (/(found|history|team|mission|tagline|brand|story|funding)/.test(normalized)) return "Company";
  if (/(install|fix|fitting|labou?r|mainten|durab|lifespan|transport|damage|thickness|weight|moisture|scratch|crack|outdoor|exterior|weather|waterproof|apply|application|last|long)/.test(normalized)) return "Installation";
  if (/(sustainab|greenpro|certif|recycl|eco|leed|igbc|griha|green building|environment|carbon|waste|zero waste|handmade|energy efficient)/.test(normalized)) return "Sustainability";
  if (/(product|material|h-uhpc|texture|wall panel|wall mural|breeze block|brick cladding|compressive|technical|design|serene|furrow|toran|ridge)/.test(normalized)) return "Products";
  if (/(price|pricing|cost|budget|rate|charges|refund|return|cancel|ship|deliver|dispatch)/.test(normalized)) return "Pricing";
  if (/(showroom|dealer|location|partner|city|office hours|mumbai|chennai|jaipur|hyderabad|kochi|pune|gurgaon|ahmedabad|raipur|bengaluru|kathmandu)/.test(normalized)) return "Locations";
  if (/(custom|customi|bespoke|tailored|made to order|custom sizes)/.test(normalized)) return "Customization";
  return "General";
}

function extractKeywords(question: string) {
  const normalized = question.toLowerCase();
  const selected = new Set<string>();

  for (const phrase of DOMAIN_TERMS) {
    if (normalized.includes(phrase)) {
      selected.add(phrase);
    }
    if (selected.size >= 5) break;
  }

  const tokens = normalized
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

  for (const token of tokens) {
    selected.add(token);
    if (selected.size >= 5) break;
  }

  return Array.from(selected).slice(0, 5).join(", ");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadQaPairs() {
  const candidatePaths = [
    path.join(__dirname, "data", "heyconcrete_additional_data_and_qa.json"),
    path.resolve(process.cwd(), "prisma", "data", "heyconcrete_additional_data_and_qa.json"),
    path.resolve(process.cwd(), "backend", "prisma", "data", "heyconcrete_additional_data_and_qa.json")
  ];
  let filePath = candidatePaths[0];

  for (const candidatePath of candidatePaths) {
    try {
      await access(candidatePath);
      filePath = candidatePath;
      break;
    } catch {
      continue;
    }
  }

  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as { qa_pairs?: QaPair[] };
  return parsed.qa_pairs ?? [];
}

export async function seedFaqEntries(prisma: PrismaClient) {
  await prisma.faqEntry.deleteMany();

  for (const entry of OFFICIAL_FAQ) {
    await prisma.faqEntry.create({ data: entry });
  }

  const qaPairs = await loadQaPairs();
  for (const pair of qaPairs) {
    const question = pair.question.trim();
    const answer = pair.answer.trim();
    const id = slugifyQuestion(question);

    const exists = await prisma.faqEntry.findUnique({
      where: { id }
    });
    if (exists) continue;

    await prisma.faqEntry.create({
      data: {
        id,
        question,
        answer,
        category: inferCategory(question),
        keywords: extractKeywords(question)
      }
    });
  }
}
