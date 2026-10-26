/* ===================================================================
   MOTOTAXI ADMIN — i18n.js
   FR / EN dictionary. Persisted choice in localStorage("mototaxi.lang").
   Apply on data-i18n attributes after DOM is ready.
   =================================================================== */

const I18N = {
  en: {
    // Sidebar / nav
    'nav.dashboard': 'Dashboard',
    'nav.customers': 'Customers',
    'nav.drivers': 'Drivers',
    'nav.rides': 'Rides / Bookings',
    'nav.vehicles': 'Vehicles',
    'nav.wallets': 'Wallets',
    'nav.transactions': 'Transactions',
    'nav.commissions': 'Commission Management',
    'nav.pricing': 'Fare Pricing',
    'nav.reports': 'Reports & Analytics',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'nav.main': 'Operations',
    'nav.fintech': 'Finance',
    'nav.system': 'System',
    // Topbar
    'topbar.search': 'Search customers, drivers, rides, transactions…',
    'topbar.notifications': 'Notifications',
    'topbar.viewall': 'View all',
    'topbar.profile': 'Admin Profile',
    'topbar.settings': 'Settings',
    'topbar.logout': 'Logout',
    'topbar.admin': 'Super Admin',
    // Common
    'common.actions': 'Actions',
    'common.view': 'View',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.cancel': 'Cancel',
    'common.save': 'Save Changes',
    'common.reset': 'Reset',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.export': 'Export CSV',
    'common.print': 'Print Report',
    'common.search': 'Search…',
    'common.status': 'Status',
    'common.all': 'All',
    'common.prev': 'Previous',
    'common.next': 'Next',
    'common.of': 'of',
    'common.showing': 'Showing',
    'common.records': 'records',
    'common.noResults': 'No matching records',
    'common.tryDifferent': 'Try a different search or filter.',
    // Login
    'login.welcome': 'Welcome back',
    'login.subtitle': 'Sign in to your MOTOTAXI admin account.',
    'login.identifier': 'Mobile number or email',
    'login.identifier.ph': '+237 6 … or you@example.com',
    'login.password': 'Password',
    'login.password.ph': 'Enter your password',
    'login.remember': 'Remember me on this device',
    'login.forgot': 'Forgot password?',
    'login.signin': 'Sign In',
    'login.demoNote': 'This is a static demo — no real authentication is performed.',
    'login.noAccount': 'Need access for your team?',
    'login.contact': 'Contact your MOTOTAXI account manager',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.customers': 'Clients',
    'nav.drivers': 'Chauffeurs',
    'nav.rides': 'Courses / Réservations',
    'nav.vehicles': 'Véhicules',
    'nav.wallets': 'Portefeuilles',
    'nav.transactions': 'Transactions',
    'nav.commissions': 'Gestion des Commissions',
    'nav.pricing': 'Tarification',
    'nav.reports': 'Rapports & Analyses',
    'nav.settings': 'Paramètres',
    'nav.logout': 'Déconnexion',
    'nav.main': 'Opérations',
    'nav.fintech': 'Finance',
    'nav.system': 'Système',
    'topbar.search': 'Rechercher clients, chauffeurs, courses, transactions…',
    'topbar.notifications': 'Notifications',
    'topbar.viewall': 'Voir tout',
    'topbar.profile': 'Profil Admin',
    'topbar.settings': 'Paramètres',
    'topbar.logout': 'Déconnexion',
    'topbar.admin': 'Super Admin',
    'common.actions': 'Actions',
    'common.view': 'Voir',
    'common.edit': 'Modifier',
    'common.delete': 'Supprimer',
    'common.cancel': 'Annuler',
    'common.save': 'Enregistrer',
    'common.reset': 'Réinitialiser',
    'common.confirm': 'Confirmer',
    'common.close': 'Fermer',
    'common.export': 'Exporter CSV',
    'common.print': 'Imprimer le Rapport',
    'common.search': 'Rechercher…',
    'common.status': 'Statut',
    'common.all': 'Tous',
    'common.prev': 'Précédent',
    'common.next': 'Suivant',
    'common.of': 'sur',
    'common.showing': 'Affichage de',
    'common.records': 'enregistrements',
    'common.noResults': 'Aucun enregistrement trouvé',
    'common.tryDifferent': 'Essayez une autre recherche ou un autre filtre.',
    'login.welcome': 'Bon retour',
    'login.subtitle': 'Connectez-vous à votre compte admin MOTOTAXI.',
    'login.identifier': 'Numéro de mobile ou e-mail',
    'login.identifier.ph': '+237 6 … ou vous@exemple.com',
    'login.password': 'Mot de passe',
    'login.password.ph': 'Saisissez votre mot de passe',
    'login.remember': 'Se souvenir de moi',
    'login.forgot': 'Mot de passe oublié ?',
    'login.signin': 'Se Connecter',
    'login.demoNote': "Ceci est une démo statique — aucune authentification réelle n'est effectuée.",
    'login.noAccount': "Besoin d'accès pour votre équipe ?",
    'login.contact': 'Contactez votre responsable de compte MOTOTAXI',
  }
};

const I18N_CURRENT = (() => {
  const saved = localStorage.getItem('mototaxi.lang');
  return (saved === 'fr' || saved === 'en') ? saved : 'en';
})();

function t(key) {
  return (I18N[I18N_CURRENT] && I18N[I18N_CURRENT][key]) || I18N.en[key] || key;
}

function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
  });
  document.documentElement.setAttribute('lang', I18N_CURRENT);
  document.querySelectorAll('.lang-switch button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === I18N_CURRENT);
  });
}

function setLang(lang) {
  if (lang !== 'fr' && lang !== 'en') return;
  localStorage.setItem('mototaxi.lang', lang);
  location.reload();
}

window.MOTOTAXI_I18N = { t, applyI18n, setLang, current: () => I18N_CURRENT };
