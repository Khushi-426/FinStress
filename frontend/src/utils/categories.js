export const CATEGORIES = [
  { id: 'income',          label: 'Income',          icon: '\ud83d\udcb5', type: 'income',   color: '#6fcf97' },
  { id: 'financial_aid',   label: 'Financial Aid',   icon: '\ud83c\udf93', type: 'income',   color: '#8faeff' },
  { id: 'housing',         label: 'Housing',         icon: '\ud83c\udfe0', type: 'expense',  color: '#8faeff' },
  { id: 'food',            label: 'Food',            icon: '\ud83c\udf71', type: 'expense',  color: '#a4c2ff' },
  { id: 'transportation',  label: 'Transport',       icon: '\ud83d\ude8c', type: 'expense',  color: '#7a9ec0' },
  { id: 'books_supplies',  label: 'Books & Supplies',icon: '\ud83d\udcda', type: 'expense',  color: '#9baef5' },
  { id: 'entertainment',   label: 'Entertainment',   icon: '\ud83c\udfae', type: 'expense',  color: '#e57373' },
  { id: 'personal_care',   label: 'Personal Care',   icon: '\ud83e\uddf4', type: 'expense',  color: '#6f8df5' },
  { id: 'technology',      label: 'Technology',      icon: '\ud83d\udcbb', type: 'expense',  color: '#6fcf97' },
  { id: 'health_wellness', label: 'Health',          icon: '\u2764\ufe0f', type: 'expense',  color: '#ef9a9a' },
  { id: 'tuition',         label: 'Tuition',         icon: '\ud83c\udfeb', type: 'expense',  color: '#7f8cf0' },
  { id: 'miscellaneous',   label: 'Miscellaneous',   icon: '\ud83d\udce6', type: 'expense',  color: '#90a4ae' },
];

export const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
export const EXPENSE_CATS = CATEGORIES.filter(c => c.type === 'expense');
export const INCOME_CATS  = CATEGORIES.filter(c => c.type === 'income');

export const getMergedCategories = (custom = []) => {
  const merged = [...CATEGORIES];
  custom.forEach(c => {
    if (!merged.find(m => m.id === c.id)) {
      merged.push({
        id: c.id,
        label: c.label,
        icon: c.icon || '📦',
        type: c.type || 'expense',
        color: c.color || '#90a4ae'
      });
    }
  });
  return merged;
};

export const getMergedExpenseCats = (custom = []) => {
  return getMergedCategories(custom).filter(c => c.type === 'expense');
};

export const fmt  = (n) => '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
export const fmtSigned = (n) => (n >= 0 ? '+' : '-') + fmt(n);
export const pct  = (n) => Math.round(n * 10) / 10 + '%';

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const monthLabel   = (m) => {
  const [y, mo] = m.split('-');
  return new Date(+y, +mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const STRESS_COLOR = (l) => l === 'Low' ? '#6fcf97' : l === 'Medium' ? '#f2c94c' : '#e57373';
export const STRESS_BG    = (l) => l === 'Low' ? '#e6f4ea' : l === 'Medium' ? '#fff9e6' : '#fdf2f2';
