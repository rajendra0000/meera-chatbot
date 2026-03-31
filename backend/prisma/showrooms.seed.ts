import { PrismaClient } from "@prisma/client";

const showrooms = [
  { id: "udaipur-hq", name: "Udaipur HQ", city: "Udaipur", address: "Bedla, Udaipur, Rajasthan", contact: "Hey Concrete Headquarters" },
  { id: "delhi-kasa-decor", name: "Kasa Decor", city: "Delhi", address: "Rajouri Garden, New Delhi", contact: "Hey Concrete Display Partner" },
  { id: "bengaluru-maruthi-ceramics", name: "Maruthi Ceramics", city: "Bengaluru", address: "HRBR Layout, Bengaluru", contact: "Hey Concrete Display Partner" },
  { id: "hyderabad-tranceform", name: "Tranceform", city: "Hyderabad", address: "Jubilee Hills, Hyderabad", contact: "Hey Concrete Display Partner" },
  { id: "bengaluru-maruthi-emporia", name: "MARUTHI EMPORIA", city: "Bengaluru", address: "74/1-2989-C, Mezzanine Floor, Indiranagar, Bangalore 560038", contact: "+91 9251597924" },
  { id: "guwahati-bath-sanitary", name: "BATH & SANITARY", city: "Guwahati", address: "Christian Basti, Opp Aaykar Bhawan GS Road, Guwahati 781005", contact: "+91 9251597924" },
  { id: "indore-stone-world", name: "STONE WORLD", city: "Indore", address: "Plot No 116, Sector FB, Ring Road, Indore 452016", contact: "+91 9251597924" },
  { id: "surat-rock-decor", name: "ROCK DECOR", city: "Surat", address: "Plot no 7 Balaji Industrial-2, Gandhi Kutir, Surat 395017", contact: "+91 9251597924" },
  { id: "bhubaneswar-clay", name: "CLAY BY LINGARAJ GRANITES", city: "Bhubaneswar", address: "8/A, Near Sai International School, Chandaka Industrial Estate, Bhubaneswar 751024", contact: "+91 9251597924" },
  { id: "kochi-arknack", name: "ARKNACK", city: "Kochi", address: "No. 40/2510 A, Surabhi Road, Edappally P.O., Ernakulam, Kerala 682024", contact: "+91 9251597924" },
  { id: "coimbatore-kiba", name: "KIBA KITCHEN & BATH STUDIO", city: "Coimbatore", address: "No. 100, Bashyakarlu Road West, R S Puram, Coimbatore 641002", contact: "+91 9251597924" },
  { id: "pune-symmetry", name: "SYMMETRY", city: "Pune", address: "Gala No. 1, Ground Floor, Gangadham-Shatrunjay Mandir Road, Pune 411037", contact: "+91 9251597924" },
  { id: "siliguri-io-studio", name: "IO STUDIO", city: "Siliguri", address: "2nd Floor, Tradium Building, Chayan Para, Check Post, Siliguri 734001", contact: "+91 9251597924" },
  { id: "meerut-parasnath", name: "PARASNATH", city: "Meerut", address: "SLJ MART Main Divider Road Near IIMT Hospital, Ganga Nagar Meerut", contact: "+91 9251597924" },
  { id: "dehradun-luxxiro", name: "LUXXIRO", city: "Dehradun", address: "29, Balbir Rd, Dalanwala, Dehradun, Uttarakhand 248001", contact: "+91 9251597924" },
  { id: "bhilwara-house-of-stones", name: "HOUSE OF STONES", city: "Bhilwara", address: "D-20, Chittorgarh Rd, Bhilwara, Rajasthan 311001", contact: "+91 9251597924" },
  { id: "nagpur-natural-stones", name: "NATURAL STONES", city: "Nagpur", address: "KDK College Chowk, Plot No. 125, KDK College Road, Nagpur 440025", contact: "+91 9251597924" },
  { id: "kota-aura", name: "AURA", city: "Kota", address: "A-93 New Dhanmandi, Behind Vijay Traders, Aerodrame Kota", contact: "+91 9251597924" },
  { id: "ghaziabad-aggarwal", name: "AGGARWAL BATH CONCEPTS", city: "Ghaziabad", address: "D 11 Kavi Nagar Ind Area, Near Diamond Flyover, Ghaziabad", contact: "+91 9251597924" },
  { id: "mumbai-blue-loft", name: "BLUE LOFT FURNITURE STORE", city: "Mumbai", address: "F9, First Floor, Laxmi Mills Compound, Shakti Mills Lane, Mahalaxmi, Mumbai 400011", contact: "+91 9251597924" },
  { id: "karnal-chaudhary-marbles", name: "CHAUDHARY MARBLES", city: "Karnal", address: "Near Village Salaru, Indri Road, Karnal, Haryana 132001", contact: "+91 9251597924" },
  { id: "hubballi-malani", name: "MALANI GRANITES AND TILES", city: "Hubballi", address: "14, Mishrikoti Village, Karwar Road, Hubballi 581204", contact: "+91 9251597924" },
  { id: "mohali-tile-studio", name: "THE TILE STUDIO", city: "Mohali", address: "Plot No 403, Sector 82, Mohali 140307", contact: "+91 9251597924" },
  { id: "gurgaon-de-ceramica", name: "DE CERAMICA", city: "Gurgaon", address: "Gurgaon, Haryana", contact: "+91 9251597924" },
  { id: "mumbai-second", name: "MUMBAI PARTNER 2", city: "Mumbai", address: "Mumbai, Maharashtra", contact: "+91 9251597924" },
  { id: "ahmedabad-partner", name: "AHMEDABAD PARTNER", city: "Ahmedabad", address: "Ahmedabad, Gujarat", contact: "+91 9251597924" },
  { id: "raipur-partner", name: "RAIPUR PARTNER", city: "Raipur", address: "Raipur, Chhattisgarh", contact: "+91 9251597924" },
  { id: "chennai-partner", name: "CHENNAI PARTNER", city: "Chennai", address: "Chennai, Tamil Nadu", contact: "+91 9251597924" },
  { id: "jaipur-partner", name: "JAIPUR PARTNER", city: "Jaipur", address: "Jaipur, Rajasthan", contact: "+91 9251597924" },
  { id: "kolkata-partner", name: "KOLKATA PARTNER", city: "Kolkata", address: "Kolkata, West Bengal", contact: "+91 9251597924" },
  { id: "kathmandu-rukmani", name: "RUKMANI INTERNATIONAL", city: "Kathmandu", address: "Maitidevi, Kathmandu, Nepal 44600", contact: "+91 9251597924" }
];

export async function seedShowrooms(prisma: PrismaClient) {
  await prisma.showroom.deleteMany();

  for (const showroom of showrooms) {
    await prisma.showroom.upsert({
      where: { id: showroom.id },
      update: showroom,
      create: showroom
    });
  }
}
