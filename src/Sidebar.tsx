

interface SidebarProps {
  activePage: 'dashboard' | 'report';
  setActivePage: (page: 'dashboard' | 'report') => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function Sidebar({ activePage, setActivePage, isOpen, setIsOpen }: SidebarProps) {
  const navItems = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: '\u2302' },
    { key: 'report' as const, label: 'Laporan', icon: '\u2637' },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-200 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>
        <div className="p-5 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">KENZAI AGENT</h1>
          <p className="text-xs text-gray-500 mt-0.5">powered by NATA</p>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setActivePage(item.key); setIsOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === item.key
                  ? 'bg-teal-600/20 text-teal-400 border border-teal-600/30'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
