export const CATEGORIES = [
  { id: 'income',          label: 'Income',          icon: '💵', type: 'income',   color: '#3A7D44' },
  { id: 'financial_aid',   label: 'Financial Aid',   icon: '🎓', type: 'income',   color: '#5DADE2' },
  { id: 'housing',         label: 'Housing',         icon: '🏠', type: 'expense',  color: '#C9622F' },
  { id: 'food',            label: 'Food',            icon: '🍱', type: 'expense',  color: '#E8A080' },
  { id: 'transportation',  label: 'Transport',       icon: '🚌', type: 'expense',  color: '#3A6EA5' },
  { id: 'books_supplies',  label: 'Books & Supplies',icon: '📚', type: 'expense',  color: '#8B6FBE' },
  { id: 'entertainment',   label: 'Entertainment',   icon: '🎮', type: 'expense',  color: '#E74C3C' },
  { id: 'personal_care',   label: 'Personal Care',   icon: '🧴', type: 'expense',  color: '#A569BD' },
  { id: 'technology',      label: 'Technology',      icon: '💻', type: 'expense',  color: '#2ECC71' },
  { id: 'health_wellness', label: 'Health',          icon: '❤️', type: 'expense',  color: '#E91E63' },
  { id: 'tuition',         label: 'Tuition',         icon: '🏫', type: 'expense',  color: '#FF9800' },
  { id: 'miscellaneous',   label: 'Miscellaneous',   icon: '📦', type: 'expense',  color: '#95A5A6' },
];

export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
export const EXPENSE_CATS = CATEGORIES.filter(c => c.type === 'expense');
export const INCOME_CATS  = CATEGORIES.filter(c => c.type === 'income');

export const fmt  = (n) => '$' + Math.abs(Math.round(n)).toLocaleString();
export const fmtSigned = (n) => (n >= 0 ? '+' : '-') + fmt(n);
export const pct  = (n) => Math.round(n * 10) / 10 + '%';

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const monthLabel   = (m) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const STRESS_COLOR = (l) => l === 'Low' ? '#3A7D44' : l === 'Medium' ? '#C4841A' : '#C0392B';
export const STRESS_BG    = (l) => l === 'Low' ? '#E5F0E8' : l === 'Medium' ? '#FDF3E0' : '#FDECEC';
