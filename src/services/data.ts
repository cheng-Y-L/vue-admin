/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { User, Order, SystemLog, StatSummary, DashboardMetric, CategoryRatio } from '../types';
import { formatLocalDateTime } from '@/utils/datetime';

// Helper to generate IDs
const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).substring(2, 9)}`;

// Default Orders
const DEFAULT_ORDERS: Order[] = [
  {
    id: 'ORD-2026052601',
    customerName: '张伟',
    email: 'zhangwei@example.com',
    productName: 'MacBook Pro 14寸 M3 Max',
    category: '数码电子',
    amount: 19999,
    status: 'completed',
    date: '2026-05-26 10:15:30',
    paymentMethod: 'Alipay',
  },
  {
    id: 'ORD-2026052504',
    customerName: '李娜',
    email: 'lina@example.com',
    productName: 'iPhone 15 Pro Max 256GB',
    category: '数码电子',
    amount: 9999,
    status: 'shipping',
    date: '2026-05-25 18:24:12',
    paymentMethod: 'WeChatPay',
  },
  {
    id: 'ORD-2026052503',
    customerName: '王凯',
    email: 'wangkai@example.com',
    productName: 'Herman Miller Aeron 人体工学椅',
    category: '办公家具',
    amount: 12500,
    status: 'pending',
    date: '2026-05-25 15:02:45',
    paymentMethod: 'CreditCard',
  },
  {
    id: 'ORD-2026052502',
    customerName: '赵敏',
    email: 'zhaomin@example.com',
    productName: 'Sony WH-1000XM5 头戴无线降噪耳机',
    category: '影音娱乐',
    amount: 2499,
    status: 'completed',
    date: '2026-05-25 11:32:10',
    paymentMethod: 'Alipay',
  },
  {
    id: 'ORD-2026052408',
    customerName: '陈洋',
    email: 'chenyang@example.com',
    productName: '极客风机械键盘 Cherry红轴',
    category: '数码配件',
    amount: 899,
    status: 'canceled',
    date: '2026-05-24 22:45:15',
    paymentMethod: 'WeChatPay',
  },
  {
    id: 'ORD-2026052401',
    customerName: '刘杰',
    email: 'liujie@example.com',
    productName: '云杉实木 L型双极电动升降电脑桌',
    category: '办公家具',
    amount: 4580,
    status: 'completed',
    date: '2026-05-24 09:12:05',
    paymentMethod: 'CreditCard',
  },
  {
    id: 'ORD-2026052309',
    customerName: '孙婷',
    email: 'sunting@example.com',
    productName: '4K超清 IPS专业绘图设计显示器 27寸',
    category: '数码电子',
    amount: 3299,
    status: 'completed',
    date: '2026-05-23 17:40:50',
    paymentMethod: 'Alipay',
  },
  {
    id: 'ORD-2026052305',
    customerName: '周强',
    email: 'zhouqiang@example.com',
    productName: '智能多功能空气净化器 Pro 2',
    category: '家用电器',
    amount: 1899,
    status: 'shipping',
    date: '2026-05-23 13:10:22',
    paymentMethod: 'PayPal',
  },
  {
    id: 'ORD-2026052206',
    customerName: '吴军',
    email: 'wujun@example.com',
    productName: '极速千兆 WiFi-7 电竞无线路由器',
    category: '数码配件',
    amount: 1499,
    status: 'completed',
    date: '2026-05-22 14:23:55',
    paymentMethod: 'WeChatPay',
  },
  {
    id: 'ORD-2026052201',
    customerName: '郑洁',
    email: 'zhengjie@example.com',
    productName: '人体工学凝胶护腕鼠标垫 2个装',
    category: '办公用品',
    amount: 128,
    status: 'completed',
    date: '2026-05-22 08:34:11',
    paymentMethod: 'Alipay',
  },
  {
    id: 'ORD-2026052103',
    customerName: '林峰',
    email: 'linfeng@example.com',
    productName: '米其林智能车载便携电动打气泵',
    category: '汽车周边',
    amount: 299,
    status: 'completed',
    date: '2026-05-21 11:20:00',
    paymentMethod: 'PayPal',
  }
];

// Default System Logs
const DEFAULT_LOGS: SystemLog[] = [
  {
    id: 'LOG-001',
    operator: 'admin',
    role: '管理员',
    action: '登录系统成功',
    ip: '192.168.1.100',
    module: 'Auth',
    status: 'success',
    timestamp: '2026-05-26 09:01:23',
  },
  {
    id: 'LOG-002',
    operator: 'admin',
    role: '管理员',
    action: '修改用户权限: user_editor(运营编辑)',
    ip: '192.168.1.100',
    module: 'Permissions',
    status: 'success',
    timestamp: '2026-05-26 09:15:30',
  },
  {
    id: 'LOG-003',
    operator: 'editor',
    role: '运营编辑',
    action: '登录系统成功',
    ip: '110.231.84.42',
    module: 'Auth',
    status: 'success',
    timestamp: '2026-05-25 18:05:11',
  },
  {
    id: 'LOG-004',
    operator: 'editor',
    role: '运营编辑',
    action: '更新订单状态: ORD-2026052504 -> 运输中',
    ip: '110.231.84.42',
    module: 'OrderManage',
    status: 'success',
    timestamp: '2026-05-25 18:25:00',
  },
  {
    id: 'LOG-005',
    operator: 'viewer',
    role: '数据分析员',
    action: '尝试越权查看系统日志',
    ip: '202.102.3.99',
    module: 'Auth',
    status: 'failed',
    timestamp: '2026-05-25 16:40:12',
  },
  {
    id: 'LOG-006',
    operator: 'admin',
    role: '管理员',
    action: '停用恶意测试用户: test_user',
    ip: '192.168.1.100',
    module: 'UserManage',
    status: 'success',
    timestamp: '2026-05-25 14:22:19',
  },
  {
    id: 'LOG-007',
    operator: 'viewer',
    role: '数据分析员',
    action: '登录系统成功',
    ip: '202.102.3.99',
    module: 'Auth',
    status: 'success',
    timestamp: '2026-05-25 09:12:00',
  },
  {
    id: 'LOG-008',
    operator: 'admin',
    role: '管理员',
    action: '创建新订单: ORD-2026052501',
    ip: '192.168.1.100',
    module: 'OrderManage',
    status: 'success',
    timestamp: '2026-05-25 08:30:12',
  },
  {
    id: 'LOG-009',
    operator: 'unknown',
    role: '游客',
    action: '尝试使用错误密码进行登录 [admin]',
    ip: '58.213.111.90',
    module: 'Auth',
    status: 'failed',
    timestamp: '2026-05-24 23:15:42',
  }
];

// Historical Metrics (15 days data for rendering rich charts)
export const METRIC_HISTORY: DashboardMetric[] = [
  { date: '05-12', sales: 24200, orders: 12, visitors: 350 },
  { date: '05-13', sales: 31200, orders: 16, visitors: 420 },
  { date: '05-14', sales: 28900, orders: 14, visitors: 390 },
  { date: '05-15', sales: 35600, orders: 18, visitors: 480 },
  { date: '05-16', sales: 42100, orders: 20, visitors: 580 },
  { date: '05-17', sales: 48900, orders: 24, visitors: 650 },
  { date: '05-18', sales: 38200, orders: 19, visitors: 520 },
  { date: '05-19', sales: 41000, orders: 20, visitors: 560 },
  { date: '05-20', sales: 45600, orders: 23, visitors: 610 },
  { date: '05-21', sales: 52000, orders: 27, visitors: 700 },
  { date: '05-22', sales: 49800, orders: 25, visitors: 680 },
  { date: '05-23', sales: 61200, orders: 32, visitors: 820 },
  { date: '05-24', sales: 58300, orders: 29, visitors: 790 },
  { date: '05-25', sales: 65400, orders: 34, visitors: 890 },
  { date: '05-26', sales: 72800, orders: 38, visitors: 980 }
];

// Category ratios
export const CATEGORY_RATIOS: CategoryRatio[] = [
  { category: '数码电子', sales: 33297, count: 3, color: '#3b82f6' }, // blue-500
  { category: '办公家具', sales: 17080, count: 2, color: '#10b981' }, // emerald-500
  { category: '数码配件', sales: 2398, count: 2, color: '#f59e0b' }, // amber-500
  { category: '影音娱乐', sales: 2499, count: 1, color: '#8b5cf6' }, // violet-500
  { category: '家用电器', sales: 1899, count: 1, color: '#ef4444' }, // red-500
  { category: '办公用品', sales: 128, count: 1, color: '#ec4899' }, // pink-500
  { category: '汽车周边', sales: 299, count: 1, color: '#06b6d4' }  // cyan-500
];

// Default Summary
export const DEFAULT_SUMMARY: StatSummary = {
  todaySales: 72800,
  todaySalesChange: 11.3,
  todayOrders: 38,
  todayOrdersChange: 11.7,
  activeUsers: 980,
  activeUsersChange: 10.1,
  conversionRate: 3.88,
  conversionRateChange: 1.4
};

// Database Initialization & Management Class for local storage
class LocalDb {
  init() {
    if (!localStorage.getItem('admin_orders')) {
      localStorage.setItem('admin_orders', JSON.stringify(DEFAULT_ORDERS));
    }
    if (!localStorage.getItem('admin_logs')) {
      localStorage.setItem('admin_logs', JSON.stringify(DEFAULT_LOGS));
    }
    if (!localStorage.getItem('admin_summary')) {
      localStorage.setItem('admin_summary', JSON.stringify(DEFAULT_SUMMARY));
    }
  }

  getUsers(): User[] {
    this.init();
    return JSON.parse(localStorage.getItem('admin_users') || '[]');
  }

  saveUsers(users: User[]) {
    localStorage.setItem('admin_users', JSON.stringify(users));
  }

  getOrders(): Order[] {
    this.init();
    return JSON.parse(localStorage.getItem('admin_orders') || '[]');
  }

  saveOrders(orders: Order[]) {
    localStorage.setItem('admin_orders', JSON.stringify(orders));
  }

  getLogs(): SystemLog[] {
    this.init();
    return JSON.parse(localStorage.getItem('admin_logs') || '[]');
  }

  saveLogs(logs: SystemLog[]) {
    localStorage.setItem('admin_logs', JSON.stringify(logs));
  }

  addLog(operator: string, role: string, action: string, module: SystemLog['module'], status: SystemLog['status'], ip: string = '127.0.0.1') {
    const logs = this.getLogs();
    const newLog: SystemLog = {
      id: generateId('LOG'),
      operator,
      role,
      action,
      ip,
      module,
      status,
      timestamp: formatLocalDateTime()
    };
    logs.unshift(newLog); // Prepend to show on top
    this.saveLogs(logs);
  }

  getSummary(): StatSummary {
    this.init();
    return JSON.parse(localStorage.getItem('admin_summary') || JSON.stringify(DEFAULT_SUMMARY));
  }

  // Get current logged-in user from localStorage
  getCurrentSession(): User | null {
    const session = localStorage.getItem('admin_session');
    if (!session) return null;

    try {
      const activeUser = JSON.parse(session) as User;
      // Supabase 用户（UUID）不在本地 mock 列表，直接信任缓存
      if (activeUser.id.includes('-')) {
        return activeUser.status === 'active' ? activeUser : null;
      }
      const users = this.getUsers();
      const dbUser = users.find((u) => u.id === activeUser.id);
      if (dbUser && dbUser.status === 'active') {
        return dbUser;
      }
      return null;
    } catch {
      return null;
    }
  }

  setCurrentSession(user: User | null) {
    if (user) {
      localStorage.setItem('admin_session', JSON.stringify(user));
    } else {
      localStorage.removeItem('admin_session');
    }
  }
}

export const db = new LocalDb();
db.init(); // Auto boot
