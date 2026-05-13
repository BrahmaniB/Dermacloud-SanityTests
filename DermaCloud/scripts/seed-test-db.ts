import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import Clinic from '../models/Clinic';
import FrontdeskStaff from '../models/FrontdeskStaff';
import InventoryItem from '../models/InventoryItem';

// Load .env.test for standalone runs — when called from global-setup, MONGODB_URI is already set
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI.includes('localhost')) {
  throw new Error('Refusing to seed: MONGODB_URI does not point to localhost. Aborting to protect real data.');
}

async function seed() {
  await mongoose.connect(MONGODB_URI);

  // Wipe test collections for a clean slate on every run
  await Promise.all([
    User.deleteMany({}),
    Clinic.deleteMany({}),
    FrontdeskStaff.deleteMany({}),
    InventoryItem.deleteMany({}),
  ]);

  // Clinic admin — matches TEST_EMAIL / TEST_PASSWORD in dermacloud-tests/.env
  const doctorPassword = await bcrypt.hash('Abcd@2026', 10);
  const doctor = await User.create({
    email: 'littlelordmuniba@gmail.com',
    password: doctorPassword,
    name: 'Dr. Test',
    tier: 'tier2',
    isVerified: true,
    authProvider: 'local',
  });

  // Clinic linked to the doctor
  const clinic = await Clinic.create({
    doctorId: doctor._id,
    clinicName: 'Dr. Test',
  });

  // Link clinic back to doctor
  await User.findByIdAndUpdate(doctor._id, { clinicId: clinic._id });

  // Seed one medicine so the doctor's prescription autocomplete and the
  // frontdesk's sales datalist both have a result to find.
  // WHY "Dolo 650"? the e2e test types "Dolo" as the partial search query —
  // the inventory search API (/api/tier2/inventory/search?q=Dolo) does a text
  // or name-contains search and will return this item. The frontdesk datalist
  // also loads all inventory items and filters client-side by name, so "Dolo 650"
  // appears as the first suggestion when the frontdesk types "Dolo".
  await InventoryItem.create({
    name: 'Dolo 650',
    genericName: 'Paracetamol',
    category: 'medicine',
    type: 'otc',
    clinicId: clinic._id,
    currentStock: 100,
    minStockLevel: 10,
    unit: 'tablets',
    costPrice: 5,
    sellingPrice: 10,
    gstRate: 5,
    manufacturer: 'Micro Labs',
    status: 'active',
  });

  // Frontdesk staff — matches FRONTDESK_EMAIL / FRONTDESK_PASSWORD in dermacloud-tests/.env
  const staffPassword = await bcrypt.hash('AbCd@2027', 10);
  await FrontdeskStaff.create({
    name: 'Test Frontdesk',
    email: 'littlelordmuniba@gmail.com',
    password: staffPassword,
    phone: '9999999999',
    clinicId: clinic._id,
    doctorId: doctor._id,
    status: 'active',
    authProvider: 'local',
    permissions: {
      appointments: true,
      patients: true,
      pharmacy: true,
      sales: true,
      reports: true,
    },
  });

  console.log('✓ Test database seeded');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
