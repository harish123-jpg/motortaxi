/* ===================================================================
   MOTOTAXI ADMIN — demo-data.js
   Centralised realistic Cameroon-specific dummy data shared across pages.
   No backend. All in-memory arrays.
   =================================================================== */

const CAM_CITIES = ['Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Buea', 'Limbe', 'Kribi', 'Garoua', 'Maroua', 'Ebolowa'];
const VEHICLE_TYPES = ['Bike', 'Car'];

/* FCFA formatter: 12 500 FCFA */
function fmtFCFA(n) {
  if (n == null || isNaN(n)) n = 0;
  n = Math.round(Number(n));
  const parts = n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
  return parts + ' FCFA';
}
function fmtNumber(n) {
  if (n == null || isNaN(n)) n = 0;
  return Math.round(Number(n)).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
}
function fmtDate(d, withTime = false) {
  const date = (d instanceof Date) ? d : new Date(d);
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; minute = '2-digit'; }
  return date.toLocaleDateString('en-GB', opts).replace(',', '');
}
function fmtDateShort(d) {
  const date = (d instanceof Date) ? d : new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function timeAgo(d) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff/60) + ' min ago';
  if (diff < 86400) return Math.floor(diff/3600) + ' h ago';
  if (diff < 86400 * 7) return Math.floor(diff/86400) + ' d ago';
  return fmtDateShort(d);
}

/* ---------- Customers ---------- */
const CUSTOMERS = [
  { id: 'CUST-10241', name: 'Ayafor Emmanuel',   phone: '+237 6 78 12 34 56', email: 'ayafor.emmanuel@gmail.com',     city: 'Douala',    regDate: '2025-09-12', rides: 47, wallet: 18400,  status: 'Active' },
  { id: 'CUST-10242', name: 'Nkomo Sarah',        phone: '+237 6 99 45 67 89', email: 'sarah.nkomo@yahoo.fr',          city: 'Yaoundé',   regDate: '2025-09-18', rides: 22, wallet: 5600,   status: 'Active' },
  { id: 'CUST-10243', name: 'Tchamba Joseph',     phone: '+237 6 91 23 45 67', email: 'joseph.tchamba@gmail.com',      city: 'Bafoussam', regDate: '2025-09-21', rides: 8,  wallet: 1200,   status: 'Blocked' },
  { id: 'CUST-10244', name: 'Foka Marie',          phone: '+237 6 70 89 01 23', email: 'marie.foka@outlook.com',        city: 'Douala',    regDate: '2025-10-01', rides: 65, wallet: 32500,  status: 'Active' },
  { id: 'CUST-10245', name: 'Mvondo Patrick',      phone: '+237 6 95 12 34 56', email: 'patrick.mvondo@gmail.com',       city: 'Yaoundé',   regDate: '2025-10-04', rides: 12, wallet: 4800,   status: 'Active' },
  { id: 'CUST-10246', name: 'Biya Christelle',     phone: '+237 6 77 56 78 90', email: 'christelle.biya@yahoo.fr',      city: 'Bamenda',   regDate: '2025-10-07', rides: 3,  wallet: 600,    status: 'Active' },
  { id: 'CUST-10247', name: 'Nguele Armand',       phone: '+237 6 90 34 56 78', email: 'armand.nguele@gmail.com',       city: 'Douala',    regDate: '2025-10-10', rides: 38, wallet: 16700,  status: 'Active' },
  { id: 'CUST-10248', name: 'Kouam Sandra',        phone: '+237 6 80 12 34 56', email: 'sandra.kouam@outlook.com',      city: 'Buea',      regDate: '2025-10-12', rides: 19, wallet: 7300,   status: 'Blocked' },
  { id: 'CUST-10249', name: 'Atangana Brice',      phone: '+237 6 75 90 12 34', email: 'brice.atangana@gmail.com',      city: 'Yaoundé',   regDate: '2025-10-14', rides: 51, wallet: 24800,  status: 'Active' },
  { id: 'CUST-10250', name: 'Etogo Lydia',         phone: '+237 6 88 67 89 01', email: 'lydia.etogo@yahoo.fr',         city: 'Limbe',     regDate: '2025-10-16', rides: 7,  wallet: 1500,   status: 'Active' },
  { id: 'CUST-10251', name: 'Fon William',         phone: '+237 6 99 23 45 67', email: 'william.fon@gmail.com',         city: 'Bamenda',   regDate: '2025-10-18', rides: 28, wallet: 11200,  status: 'Active' },
  { id: 'CUST-10252', name: 'Mbida Carole',        phone: '+237 6 78 90 12 34', email: 'carole.mbida@outlook.com',      city: 'Douala',    regDate: '2025-10-20', rides: 42, wallet: 19300,  status: 'Active' },
  { id: 'CUST-10253', name: 'Ngaha Philippe',      phone: '+237 6 70 45 67 89', email: 'philippe.ngaha@gmail.com',      city: 'Kribi',     regDate: '2025-10-22', rides: 15, wallet: 6100,   status: 'Active' },
  { id: 'CUST-10254', name: 'Simo Bernadette',     phone: '+237 6 91 56 78 90', email: 'bernadette.simo@yahoo.fr',     city: 'Yaoundé',   regDate: '2025-10-23', rides: 0,  wallet: 0,      status: 'Blocked' },
  { id: 'CUST-10255', name: 'Talla Rodrigue',      phone: '+237 6 95 78 90 12', email: 'rodrigue.talla@gmail.com',      city: 'Bafoussam', regDate: '2025-10-24', rides: 34, wallet: 14800,  status: 'Active' },
  { id: 'CUST-10256', name: 'Awa Aissatou',        phone: '+237 6 77 12 34 56', email: 'aissatou.awa@outlook.com',      city: 'Garoua',    regDate: '2025-10-25', rides: 11, wallet: 4200,   status: 'Active' },
];

/* ---------- Drivers ---------- */
const DRIVERS = [
  { id: 'DRV-2041', name: 'Kamga Robert',     phone: '+237 6 78 11 22 33', vehicleType: 'Bike', vehicleModel: 'Yamaha YBR 125',     plate: 'LT 452 AC', rating: 4.8, rides: 312, earnings: 184500, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2042', name: 'Njoya Lucien',     phone: '+237 6 99 22 33 44', vehicleType: 'Car',  vehicleModel: 'Toyota Corolla 2014', plate: 'LT 789 BD', rating: 4.6, rides: 198, earnings: 412000, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2043', name: 'Mbah Jean-Pierre', phone: '+237 6 91 33 44 55', vehicleType: 'Bike', vehicleModel: 'Bajaj Pulsar 150',    plate: 'LT 124 CE', rating: 4.4, rides: 87,  earnings: 52400,  online: false, approval: 'Pending',   license: 'Pending', insurance: 'Pending',   verified: 'Pending'   },
  { id: 'DRV-2044', name: 'Simo Alain',       phone: '+237 6 70 44 55 66', vehicleType: 'Bike', vehicleModel: 'Honda CG 125',        plate: 'LT 678 DF', rating: 4.9, rides: 245, earnings: 156800, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2045', name: 'Ngomo Bertrand',   phone: '+237 6 95 55 66 77', vehicleType: 'Car',  vehicleModel: 'Hyundai Elantra 2016',plate: 'LT 334 GH', rating: 4.3, rides: 64,  earnings: 178000, online: false, approval: 'Approved',  license: 'Valid',   insurance: 'Expired',  verified: 'Verified'   },
  { id: 'DRV-2046', name: 'Tchoumi Divine',   phone: '+237 6 77 66 77 88', vehicleType: 'Bike', vehicleModel: 'TVS Star HL Plus',    plate: 'LT 901 IJ', rating: 4.7, rides: 156, earnings: 98200,  online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2047', name: 'Eyenga Yannick',   phone: '+237 6 90 77 88 99', vehicleType: 'Bike', vehicleModel: 'Yamaha YBR 125',      plate: 'LT 567 KL', rating: 4.5, rides: 102, earnings: 67400,  online: false, approval: 'Pending',   license: 'Valid',   insurance: 'Pending',   verified: 'Pending'   },
  { id: 'DRV-2048', name: 'Bekolo Herve',     phone: '+237 6 88 88 99 00', vehicleType: 'Car',  vehicleModel: 'Toyota RAV4 2018',    plate: 'LT 234 MN', rating: 4.8, rides: 224, earnings: 524000, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2049', name: 'Ngono Patrick',     phone: '+237 6 99 99 00 11', vehicleType: 'Bike', vehicleModel: 'Bajaj Pulsar 150',   plate: 'LT 890 OP', rating: 4.2, rides: 47,  earnings: 28800,  online: false, approval: 'Rejected',  license: 'Expired', insurance: 'Pending',   verified: 'Rejected'   },
  { id: 'DRV-2050', name: 'Atangana Marvin',  phone: '+237 6 78 00 11 22', vehicleType: 'Bike', vehicleModel: 'Honda CG 125',        plate: 'LT 456 QR', rating: 4.6, rides: 178, earnings: 108200, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2051', name: 'Foko Sandrine',    phone: '+237 6 91 11 22 33', vehicleType: 'Car',  vehicleModel: 'Kia Picanto 2019',    plate: 'LT 123 ST', rating: 4.7, rides: 134, earnings: 312000, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2052', name: 'Ngo Bellamy',     phone: '+237 6 70 22 33 44', vehicleType: 'Bike', vehicleModel: 'TVS Star HL Plus',    plate: 'LT 789 UV', rating: 4.3, rides: 89,  earnings: 54600,  online: false, approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
  { id: 'DRV-2053', name: 'Zang Joseph',      phone: '+237 6 95 33 44 55', vehicleType: 'Bike', vehicleModel: 'Yamaha YBR 125',      plate: 'LT 234 WX', rating: 4.9, rides: 287, earnings: 169400, online: true,  approval: 'Approved',  license: 'Valid',   insurance: 'Active',    verified: 'Verified'   },
];

/* ---------- Vehicles ---------- */
const VEHICLES = [
  { id: 'VHC-001', type: 'Bike', model: 'Yamaha YBR 125',     reg: 'LT 452 AC', driver: 'Kamga Robert',     insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-002', type: 'Car',  model: 'Toyota Corolla 2014', reg: 'LT 789 BD', driver: 'Njoya Lucien',     insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-003', type: 'Bike', model: 'Bajaj Pulsar 150',   reg: 'LT 124 CE', driver: 'Mbah Jean-Pierre', insurance: 'Pending',  verified: 'Pending',   available: false },
  { id: 'VHC-004', type: 'Bike', model: 'Honda CG 125',       reg: 'LT 678 DF', driver: 'Simo Alain',       insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-005', type: 'Car',  model: 'Hyundai Elantra 2016', reg: 'LT 334 GH', driver: 'Ngomo Bertrand',   insurance: 'Expired',  verified: 'Verified',   available: false },
  { id: 'VHC-006', type: 'Bike', model: 'TVS Star HL Plus',    reg: 'LT 901 IJ', driver: 'Tchoumi Divine',   insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-007', type: 'Bike', model: 'Yamaha YBR 125',      reg: 'LT 567 KL', driver: 'Eyenga Yannick',  insurance: 'Pending',  verified: 'Pending',   available: false },
  { id: 'VHC-008', type: 'Car',  model: 'Toyota RAV4 2018',    reg: 'LT 234 MN', driver: 'Bekolo Herve',     insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-009', type: 'Bike', model: 'Bajaj Pulsar 150',   reg: 'LT 890 OP', driver: '—',                insurance: 'Pending',  verified: 'Rejected',   available: false },
  { id: 'VHC-010', type: 'Bike', model: 'Honda CG 125',       reg: 'LT 456 QR', driver: 'Atangana Marvin',  insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-011', type: 'Car',  model: 'Kia Picanto 2019',    reg: 'LT 123 ST', driver: 'Foko Sandrine',    insurance: 'Active',   verified: 'Verified',   available: true  },
  { id: 'VHC-012', type: 'Bike', model: 'TVS Star HL Plus',   reg: 'LT 789 UV', driver: 'Ngo Bellamy',     insurance: 'Active',   verified: 'Verified',   available: false },
  { id: 'VHC-013', type: 'Bike', model: 'Yamaha YBR 125',      reg: 'LT 234 WX', driver: 'Zang Joseph',      insurance: 'Active',   verified: 'Verified',   available: true  },
];

/* ---------- Rides / Bookings ---------- */
const PICKUP_DROPS = [
  { pickup: 'Akwa',          drop: 'Bonanjo',        city: 'Douala'    },
  { pickup: 'Bonapriso',     drop: 'Akwa',           city: 'Douala'    },
  { pickup: 'Bastos',        drop: 'Mvan',            city: 'Yaoundé'   },
  { pickup: 'Damas',         drop: 'Ngousi',          city: 'Yaoundé'   },
  { pickup: 'Marché A',      drop: 'Tamdja',          city: 'Bafoussam' },
  { pickup: 'Bonaberi',      drop: 'Deido',           city: 'Douala'    },
  { pickup: 'Quartier du Lac', drop: 'Bonapriso',     city: 'Douala'    },
  { pickup: 'Mvan',          drop: 'Etoa Meki',       city: 'Yaoundé'   },
  { pickup: 'Buea Town',     drop: 'Molyko',          city: 'Buea'      },
  { pickup: 'Mile 2',        drop: 'Buea Town',       city: 'Buea'      },
  { pickup: 'Ntarfon',       drop: 'Commercial Ave',  city: 'Bamenda'   },
  { pickup: 'Kribi Plage',   drop: 'Essos',           city: 'Kribi'     },
];

const RIDES = [
  { id: 'RIDE-50124', customer: 'Ayafor Emmanuel',  driver: 'Kamga Robert',     pickup: 'Akwa',         drop: 'Bonanjo',     distance: 4.2,  vehicleType: 'Bike', base: 350, total: 1250, commission: 188, payout: 1062, night: false, status: 'Completed', date: '2026-10-25T14:23:00' },
  { id: 'RIDE-50125', customer: 'Foka Marie',        driver: 'Njoya Lucien',     pickup: 'Bonapriso',    drop: 'Akwa',        distance: 5.8,  vehicleType: 'Car',  base: 500, total: 2200, commission: 330, payout: 1870, night: true,  status: 'Completed', date: '2026-10-25T22:15:00' },
  { id: 'RIDE-50126', customer: 'Nkomo Sarah',       driver: 'Simo Alain',       pickup: 'Bastos',       drop: 'Mvan',         distance: 6.4,  vehicleType: 'Bike', base: 350, total: 1500, commission: 225, payout: 1275, night: false, status: 'Ongoing',   date: '2026-10-26T09:32:00' },
  { id: 'RIDE-50127', customer: 'Atangana Brice',    driver: 'Bekolo Herve',     pickup: 'Bonapriso',    drop: 'Akwa',         distance: 3.5,  vehicleType: 'Car',  base: 500, total: 1850, commission: 278, payout: 1572, night: false, status: 'Completed', date: '2026-10-26T11:08:00' },
  { id: 'RIDE-50128', customer: 'Nguele Armand',     driver: 'Tchoumi Divine',   pickup: 'Bonanjo',      drop: 'Deido',        distance: 7.1,  vehicleType: 'Bike', base: 350, total: 1750, commission: 263, payout: 1487, night: false, status: 'Completed', date: '2026-10-26T13:47:00' },
  { id: 'RIDE-50129', customer: 'Mbida Carole',      driver: 'Atangana Marvin',  pickup: 'Quartier du Lac', drop: 'Bonapriso', distance: 4.9,  vehicleType: 'Bike', base: 350, total: 1400, commission: 210, payout: 1190, night: false, status: 'Cancelled', date: '2026-10-26T15:02:00' },
  { id: 'RIDE-50130', customer: 'Talla Rodrigue',    driver: 'Foko Sandrine',    pickup: 'Damas',        drop: 'Ngousi',        distance: 5.4,  vehicleType: 'Car',  base: 500, total: 2050, commission: 308, payout: 1742, night: false, status: 'Completed', date: '2026-10-26T16:21:00' },
  { id: 'RIDE-50131', customer: 'Etogo Lydia',       driver: 'Zang Joseph',      pickup: 'Buea Town',    drop: 'Molyko',        distance: 2.8,  vehicleType: 'Bike', base: 350, total: 950,  commission: 143, payout: 807,  night: false, status: 'Completed', date: '2026-10-25T18:55:00' },
  { id: 'RIDE-50132', customer: 'Awa Aissatou',     driver: 'Kamga Robert',     pickup: 'Akwa',         drop: 'Bonanjo',       distance: 4.1,  vehicleType: 'Bike', base: 350, total: 1230, commission: 185, payout: 1045, night: true,  status: 'Ongoing',   date: '2026-10-26T19:18:00' },
  { id: 'RIDE-50133', customer: 'Foka Marie',        driver: 'Njoya Lucien',     pickup: 'Bonanjo',      drop: 'Bonapriso',    distance: 3.9,  vehicleType: 'Car',  base: 500, total: 1900, commission: 285, payout: 1615, night: false, status: 'Completed', date: '2026-10-25T10:42:00' },
  { id: 'RIDE-50134', customer: 'Mvondo Patrick',    driver: 'Simo Alain',       pickup: 'Mvan',         drop: 'Etoa Meki',     distance: 4.7,  vehicleType: 'Bike', base: 350, total: 1320, commission: 198, payout: 1122, night: false, status: 'Completed', date: '2026-10-24T17:33:00' },
  { id: 'RIDE-50135', customer: 'Nguele Armand',     driver: 'Bekolo Herve',     pickup: 'Akwa',         drop: 'Deido',         distance: 8.3,  vehicleType: 'Car',  base: 500, total: 2900, commission: 435, payout: 2465, night: true,  status: 'Completed', date: '2026-10-24T22:11:00' },
  { id: 'RIDE-50136', customer: 'Simo Bernadette',   driver: '—',                pickup: 'Bastos',       drop: 'Mvan',          distance: 6.0,  vehicleType: 'Bike', base: 350, total: 0,    commission: 0,   payout: 0,    night: false, status: 'Cancelled', date: '2026-10-23T08:14:00' },
  { id: 'RIDE-50137', customer: 'Atangana Brice',    driver: 'Foko Sandrine',    pickup: 'Bastos',       drop: 'Etoa Meki',     distance: 5.0,  vehicleType: 'Car',  base: 500, total: 2000, commission: 300, payout: 1700, night: false, status: 'Completed', date: '2026-10-23T15:48:00' },
  { id: 'RIDE-50138', customer: 'Foka Marie',        driver: 'Zang Joseph',      pickup: 'Bonapriso',    drop: 'Akwa',          distance: 4.3,  vehicleType: 'Bike', base: 350, total: 1280, commission: 192, payout: 1088, night: false, status: 'Completed', date: '2026-10-22T13:01:00' },
  { id: 'RIDE-50139', customer: 'Ayafor Emmanuel',   driver: 'Tchoumi Divine',   pickup: 'Akwa',         drop: 'Bonapriso',     distance: 3.7,  vehicleType: 'Bike', base: 350, total: 1100, commission: 165, payout: 935,  night: false, status: 'Completed', date: '2026-10-22T11:24:00' },
];

/* ---------- Wallets ---------- */
const WALLETS = [
  { id: 'ABC001EZ', owner: 'Ayafor Emmanuel',  type: 'Customer', phone: '+237 6 78 12 34 56', balance: 18400, credits: 56200,  debits: 37800,  status: 'Active',   lastTx: '2026-10-26T16:21:00' },
  { id: 'ABC002EZ', owner: 'Kamga Robert',     type: 'Driver',   phone: '+237 6 78 11 22 33', balance: 184500, credits: 184500, debits: 0,      status: 'Active',   lastTx: '2026-10-25T14:23:00' },
  { id: 'ABC003EZ', owner: 'Nkomo Sarah',      type: 'Customer', phone: '+237 6 99 45 67 89', balance: 5600,  credits: 18500,  debits: 12900,  status: 'Active',   lastTx: '2026-10-24T19:33:00' },
  { id: 'ABC004EZ', owner: 'Njoya Lucien',     type: 'Driver',   phone: '+237 6 99 22 33 44', balance: 412000, credits: 412000, debits: 0,      status: 'Active',   lastTx: '2026-10-25T22:15:00' },
  { id: 'ABC005EZ', owner: 'AGENT-DLA-1',      type: 'Agent',    phone: '+237 6 70 00 00 01', balance: 0,      credits: 0,      debits: 0,      status: 'Active',   lastTx: '2026-10-26T10:00:00' },
  { id: 'ABC006EZ', owner: 'Tchamba Joseph',   type: 'Customer', phone: '+237 6 91 23 45 67', balance: 1200,  credits: 6800,   debits: 5600,   status: 'Inactive', lastTx: '2026-10-15T11:20:00' },
  { id: 'ABC007EZ', owner: 'Foka Marie',        type: 'Customer', phone: '+237 6 70 89 01 23', balance: 32500, credits: 95400,  debits: 62900,  status: 'Active',   lastTx: '2026-10-26T11:08:00' },
  { id: 'ABC008EZ', owner: 'Simo Alain',        type: 'Driver',   phone: '+237 6 70 44 55 66', balance: 156800, credits: 156800, debits: 0,     status: 'Active',   lastTx: '2026-10-26T09:32:00' },
  { id: 'ABC009EZ', owner: 'AGENT-YDE-1',      type: 'Agent',    phone: '+237 6 70 00 00 02', balance: 0,      credits: 0,      debits: 0,      status: 'Active',   lastTx: '2026-10-26T08:45:00' },
  { id: 'ABC010EZ', owner: 'Mvondo Patrick',    type: 'Customer', phone: '+237 6 95 12 34 56', balance: 4800,  credits: 16400,  debits: 11600,  status: 'Active',   lastTx: '2026-10-24T17:33:00' },
  { id: 'ABC011EZ', owner: 'Biya Christelle',   type: 'Customer', phone: '+237 6 77 56 78 90', balance: 600,   credits: 2000,   debits: 1400,   status: 'Active',   lastTx: '2026-10-21T13:00:00' },
  { id: 'ABC012EZ', owner: 'Nguele Armand',     type: 'Customer', phone: '+237 6 90 34 56 78', balance: 16700, credits: 48200,  debits: 31500,  status: 'Active',   lastTx: '2026-10-26T13:47:00' },
  { id: 'ABC013EZ', owner: 'Bekolo Herve',      type: 'Driver',   phone: '+237 6 88 88 99 00', balance: 524000, credits: 524000, debits: 0,     status: 'Active',   lastTx: '2026-10-26T11:08:00' },
  { id: 'ABC014EZ', owner: 'Kouam Sandra',       type: 'Customer', phone: '+237 6 80 12 34 56', balance: 7300,  credits: 22400,  debits: 15100,  status: 'Inactive', lastTx: '2026-10-17T16:30:00' },
  { id: 'ABC015EZ', owner: 'Atangana Brice',     type: 'Customer', phone: '+237 6 75 90 12 34', balance: 24800, credits: 71200,  debits: 46400,  status: 'Active',   lastTx: '2026-10-26T11:08:00' },
  { id: 'ABC016EZ', owner: 'Etogo Lydia',        type: 'Customer', phone: '+237 6 88 67 89 01', balance: 1500,  credits: 5100,   debits: 3600,   status: 'Active',   lastTx: '2026-10-25T18:55:00' },
];

/* ---------- Transactions ---------- */
const TRANSACTIONS = [
  { id: 'TXN-901245', invoice: 'INV-2026-1001', sender: 'Ayafor Emmanuel',  receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1250, fee: 25,    total: 1275,  type: 'Ride Payment',      status: 'Successful', date: '2026-10-26T14:23:00' },
  { id: 'TXN-901246', invoice: 'INV-2026-1002', sender: 'MOTOTAXI',         receiver: 'Kamga Robert',   direction: 'Received', amount: 1062, fee: 0,     total: 1062, type: 'Driver Payout',     status: 'Successful', date: '2026-10-26T14:24:00' },
  { id: 'TXN-901247', invoice: 'INV-2026-1003', sender: 'Foka Marie',       receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 2200, fee: 50,    total: 2250, type: 'Ride Payment',      status: 'Successful', date: '2026-10-25T22:15:00' },
  { id: 'TXN-901248', invoice: 'INV-2026-1004', sender: 'Nkomo Sarah',      receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1500, fee: 35,    total: 1535, type: 'Wallet Topup',     status: 'Pending',   date: '2026-10-26T09:32:00' },
  { id: 'TXN-901249', invoice: 'INV-2026-1005', sender: 'MOTOTAXI',         receiver: 'Njoya Lucien',   direction: 'Received', amount: 1870, fee: 0,     total: 1870, type: 'Driver Payout',     status: 'Successful', date: '2026-10-25T22:16:00' },
  { id: 'TXN-901250', invoice: 'INV-2026-1006', sender: 'Atangana Brice',   receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1850, fee: 40,    total: 1890, type: 'Ride Payment',      status: 'Successful', date: '2026-10-26T11:08:00' },
  { id: 'TXN-901251', invoice: 'INV-2026-1007', sender: 'Mbida Carole',     receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1400, fee: 30,    total: 1430, type: 'Ride Refund',      status: 'Failed',    date: '2026-10-26T15:02:00' },
  { id: 'TXN-901252', invoice: 'INV-2026-1008', sender: 'Nguele Armand',    receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1750, fee: 35,    total: 1785, type: 'Ride Payment',      status: 'Successful', date: '2026-10-26T13:47:00' },
  { id: 'TXN-901253', invoice: 'INV-2026-1009', sender: 'MOTOTAXI',         receiver: 'Tchoumi Divine', direction: 'Received', amount: 1487, fee: 0,     total: 1487, type: 'Driver Payout',     status: 'Successful', date: '2026-10-26T13:48:00' },
  { id: 'TXN-901254', invoice: 'INV-2026-1010', sender: 'Talla Rodrigue',   receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 2050, fee: 45,    total: 2095, type: 'Ride Payment',      status: 'Successful', date: '2026-10-26T16:21:00' },
  { id: 'TXN-901255', invoice: 'INV-2026-1011', sender: 'Etogo Lydia',      receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 950,  fee: 20,    total: 970,  type: 'Ride Payment',      status: 'Successful', date: '2026-10-25T18:55:00' },
  { id: 'TXN-901256', invoice: 'INV-2026-1012', sender: 'Foka Marie',       receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1900, fee: 40,    total: 1940, type: 'Ride Payment',      status: 'Successful', date: '2026-10-25T10:42:00' },
  { id: 'TXN-901257', invoice: 'INV-2026-1013', sender: 'Mvondo Patrick',   receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1320, fee: 30,    total: 1350, type: 'Ride Payment',      status: 'Pending',   date: '2026-10-24T17:33:00' },
  { id: 'TXN-901258', invoice: 'INV-2026-1014', sender: 'Nguele Armand',    receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 2900, fee: 60,    total: 2960, type: 'Ride Payment',      status: 'Successful', date: '2026-10-24T22:11:00' },
  { id: 'TXN-901259', invoice: 'INV-2026-1015', sender: 'MOTOTAXI',         receiver: 'Bekolo Herve',   direction: 'Received', amount: 2465, fee: 0,     total: 2465, type: 'Driver Payout',     status: 'Successful', date: '2026-10-24T22:12:00' },
  { id: 'TXN-901260', invoice: 'INV-2026-1016', sender: 'Atangana Brice',   receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 2000, fee: 45,    total: 2045, type: 'Ride Payment',      status: 'Successful', date: '2026-10-23T15:48:00' },
  { id: 'TXN-901261', invoice: 'INV-2026-1017', sender: 'Foka Marie',       receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1280, fee: 25,    total: 1305, type: 'Ride Payment',      status: 'Successful', date: '2026-10-22T13:01:00' },
  { id: 'TXN-901262', invoice: 'INV-2026-1018', sender: 'Ayafor Emmanuel',  receiver: 'MOTOTAXI',      direction: 'Sent',     amount: 1100, fee: 22,    total: 1122, type: 'Ride Payment',      status: 'Failed',    date: '2026-10-22T11:24:00' },
];

/* ---------- Agents / Commission ---------- */
const AGENTS = [
  { id: 'AGT-DLA-01', name: 'Talla Robert',      phone: '+237 6 70 00 00 01', city: 'Douala',    txns: 412, volume: 8245000,  earned: 412250,  pending: 24500,  status: 'Active'   },
  { id: 'AGT-DLA-02', name: 'Kamga Sandrine',     phone: '+237 6 70 00 00 02', city: 'Douala',    txns: 287, volume: 5740000,  earned: 287000,  pending: 0,       status: 'Active'   },
  { id: 'AGT-YDE-01', name: 'Atangana Brice',     phone: '+237 6 70 00 00 03', city: 'Yaoundé',   txns: 356, volume: 7120000,  earned: 356000,  pending: 18000,   status: 'Active'   },
  { id: 'AGT-YDE-02', name: 'Biya Marvin',        phone: '+237 6 70 00 00 04', city: 'Yaoundé',   txns: 198, volume: 3960000,  earned: 198000,  pending: 0,       status: 'Active'   },
  { id: 'AGT-BFS-01', name: 'Nkouam Patrick',     phone: '+237 6 70 00 00 05', city: 'Bafoussam', txns: 124, volume: 2480000,  earned: 124000,  pending: 12500,   status: 'Active'   },
  { id: 'AGT-BUE-01', name: 'Fomba Sandrine',     phone: '+237 6 70 00 00 06', city: 'Buea',      txns: 89,  volume: 1780000,  earned: 89000,   pending: 0,       status: 'Active'   },
  { id: 'AGT-KRB-01', name: 'Ndongo Joseph',      phone: '+237 6 70 00 00 07', city: 'Kribi',     txns: 67,  volume: 1340000,  earned: 67000,   pending: 8500,    status: 'Inactive' },
];

/* ---------- Fare config (used by pricing.html) ---------- */
const FARE_RULES = {
  Bike: { base: 350, perKm: 150, min: 350, commissionPct: 15, nightEnabled: true, nightStart: '22:00', nightEnd: '05:00', multiplier: 1.3 },
  Car:  { base: 500, perKm: 250, min: 500, commissionPct: 15, nightEnabled: true, nightStart: '22:00', nightEnd: '05:00', multiplier: 1.3 }
};

/* ---------- Activity feed for dashboard ---------- */
const ACTIVITY_FEED = [
  { kind: 'green',  title: 'Ride RIDE-50130 completed', desc: 'Foko Sandrine → Talla Rodrigue — 2 050 FCFA', time: '2 min ago' },
  { kind: 'amber',  title: 'TXN-901248 pending',         desc: 'Nkomo Sarah wallet topup — 1 500 FCFA',       time: '12 min ago' },
  { kind: 'blue',   title: 'New driver registration',    desc: 'Eyenga Yannick (Bike) awaiting approval',     time: '38 min ago' },
  { kind: 'red',    title: 'Ride RIDE-50136 cancelled',  desc: 'Simo Bernadette — driver not assigned',      time: '1 h ago' },
  { kind: 'green',  title: 'Wallet topup success',       desc: 'Foka Marie credited 5 000 FCFA',              time: '2 h ago' },
  { kind: 'blue',   title: 'Commission paid',            desc: 'Agent AGT-DLA-01 received 41 250 FCFA',      time: '3 h ago' },
];

/* ---------- Recent bookings + transactions convenience slices ---------- */
const RECENT_BOOKINGS = RIDES.slice(0, 6);
const RECENT_TXNS = TRANSACTIONS.slice(0, 6);

/* ---------- Dashboard summary numbers ---------- */
const DASH_STATS = {
  totalCustomers: 16,
  activeDrivers: 8,
  ridesToday: 9,
  revenueToday: 18450,
  commissionToday: 2770,
  totalWalletBalance: 1438700,
  pendingTxns: 2,
};

/* ---------- 30-day revenue + ride trend for charts ---------- */
const DASHBOARD_TRENDS = (() => {
  const days = [];
  const today = new Date('2026-10-26');
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const weekend = (d.getDay() === 0 || d.getDay() === 6);
    const base = weekend ? 18500 : 14200;
    const rev = Math.round(base + (Math.sin(i) * 2400) + (i % 5) * 320);
    const rides = Math.round(rev / 1400);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      revenue: rev,
      rides,
      commission: Math.round(rev * 0.15),
      payout: Math.round(rev * 0.85),
    });
  }
  return days;
})();

window.MOTOTAXI_DATA = {
  CAM_CITIES, VEHICLE_TYPES, CUSTOMERS, DRIVERS, VEHICLES, RIDES, WALLETS, TRANSACTIONS, AGENTS,
  FARE_RULES, ACTIVITY_FEED, RECENT_BOOKINGS, RECENT_TXNS, DASH_STATS, DASHBOARD_TRENDS,
  fmtFCFA, fmtNumber, fmtDate, fmtDateShort, timeAgo
};
