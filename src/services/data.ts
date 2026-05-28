/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import type { User, Order, Task, TaskApplication, TaskSubmission, SystemLog, StatSummary, DashboardMetric, CategoryRatio } from '../types';
import { normalizeRole, effectivePermissions } from '@/constants/roles';
import { normalizeCertificationStatus } from '@/utils/lawyer-cert';
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

// Default Tasks (publisher demo data)
const DEFAULT_TASKS: Task[] = [
  {
    id: 'task_demo_001',
    publisherId: 'demo_publisher',
    title: '劳动合同纠纷咨询与代理',
    taskType: '劳动争议',
    region: '上海市',
    description: '员工被违法解除劳动合同，需律师提供法律咨询并代理仲裁。',
    budget: 8000,
    deadline: '2026-06-30T23:59:59.000Z',
    attachmentUrls: [],
    status: 'pending',
    createdAt: '2026-05-26 10:00:00',
    updatedAt: '2026-05-26 10:00:00',
  },
  {
    id: 'task_demo_002',
    publisherId: 'demo_publisher',
    title: '股权转让协议审查',
    taskType: '合同审查',
    region: '北京市',
    description: '拟收购初创公司 30% 股权，需专业律师审查协议条款。',
    budget: 15000,
    deadline: '2026-06-15T23:59:59.000Z',
    attachmentUrls: [],
    status: 'in_progress',
    assignedLawyerId: 'demo_lawyer',
    createdAt: '2026-05-24 14:30:00',
    updatedAt: '2026-05-25 09:00:00',
  },
  {
    id: 'task_demo_003',
    publisherId: 'demo_publisher',
    title: '商标侵权诉讼',
    taskType: '知识产权',
    region: '广东省',
    description: '',
    budget: null,
    deadline: null,
    attachmentUrls: [],
    status: 'draft',
    createdAt: '2026-05-27 16:20:00',
    updatedAt: '2026-05-27 16:20:00',
  },
  {
    id: 'task_demo_004',
    publisherId: 'demo_publisher',
    title: '企业法律顾问年度服务',
    taskType: '法律顾问',
    region: '浙江省',
    description: '为中小企业提供全年法律顾问服务，含合同审查与合规咨询。',
    budget: 50000,
    deadline: '2026-12-31T23:59:59.000Z',
    attachmentUrls: [],
    status: 'awaiting_completion',
    assignedLawyerId: 'demo_lawyer',
    createdAt: '2026-05-20 09:00:00',
    updatedAt: '2026-05-28 16:30:00',
  },
  {
    id: 'task_demo_005',
    publisherId: 'demo_publisher',
    title: '商事仲裁代理',
    taskType: '商事仲裁',
    region: '江苏省',
    description: '供应商货款争议，需代理参加仲裁并提交证据材料。',
    budget: 12000,
    deadline: '2026-07-01T23:59:59.000Z',
    attachmentUrls: [],
    status: 'completed',
    assignedLawyerId: 'demo_lawyer',
    createdAt: '2026-05-10 11:00:00',
    updatedAt: '2026-05-22 14:00:00',
  },
  {
    id: 'task_demo_006',
    publisherId: 'demo_publisher',
    title: '离婚财产分割咨询',
    taskType: '婚姻家庭',
    region: '四川省',
    description: '双方对房产分割存在争议，需律师出具方案并代理调解。',
    budget: 6000,
    deadline: '2026-06-20T23:59:59.000Z',
    attachmentUrls: [],
    status: 'closed',
    assignedLawyerId: 'demo_lawyer',
    createdAt: '2026-05-05 08:00:00',
    updatedAt: '2026-05-15 10:00:00',
  },
];

// Default Task Applications (local demo)
const DEFAULT_TASK_APPLICATIONS: TaskApplication[] = [
  {
    id: 'app_demo_001',
    taskId: 'task_demo_002',
    lawyerId: 'demo_lawyer',
    proposal: '具有 8 年并购尽调经验，可在一周内完成协议审查并出具修改意见。',
    quote: 14500,
    status: 'accepted',
    createdAt: '2026-05-24 16:00:00',
    updatedAt: '2026-05-25 09:00:00',
  },
  {
    id: 'app_demo_002',
    taskId: 'task_demo_004',
    lawyerId: 'demo_lawyer',
    proposal: '可提供驻场+远程结合的顾问服务，含月度合规报告。',
    quote: 48000,
    status: 'accepted',
    createdAt: '2026-05-20 10:00:00',
    updatedAt: '2026-05-21 09:00:00',
  },
  {
    id: 'app_demo_003',
    taskId: 'task_demo_005',
    lawyerId: 'demo_lawyer',
    proposal: '熟悉本地仲裁规则，曾代理多起货款争议案件。',
    quote: 11500,
    status: 'accepted',
    createdAt: '2026-05-10 12:00:00',
    updatedAt: '2026-05-11 09:00:00',
  },
  {
    id: 'app_demo_004',
    taskId: 'task_demo_006',
    lawyerId: 'demo_lawyer',
    proposal: '专注婚姻家庭领域，可协助双方达成调解方案。',
    quote: 5500,
    status: 'accepted',
    createdAt: '2026-05-05 09:00:00',
    updatedAt: '2026-05-06 09:00:00',
  },
];

const DEFAULT_TASK_SUBMISSIONS: TaskSubmission[] = [];

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
    action: '修改用户权限: user_publisher(发布侧)',
    ip: '192.168.1.100',
    module: 'Permissions',
    status: 'success',
    timestamp: '2026-05-26 09:15:30',
  },
  {
    id: 'LOG-003',
    operator: 'publisher',
    role: '发布侧',
    action: '登录系统成功',
    ip: '110.231.84.42',
    module: 'Auth',
    status: 'success',
    timestamp: '2026-05-25 18:05:11',
  },
  {
    id: 'LOG-004',
    operator: 'publisher',
    role: '发布侧',
    action: '更新订单状态: ORD-2026052504 -> 运输中',
    ip: '110.231.84.42',
    module: 'OrderManage',
    status: 'success',
    timestamp: '2026-05-25 18:25:00',
  },
  {
    id: 'LOG-005',
    operator: 'lawyer',
    role: '律师',
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
    operator: 'lawyer',
    role: '律师',
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
  private migrateLegacyRoles() {
    const rawUsers = localStorage.getItem('admin_users')
    if (rawUsers) {
      const users = JSON.parse(rawUsers) as User[]
      let usersChanged = false
      const migratedUsers = users.map((u) => {
        const role = normalizeRole(u.role)
        const certificationStatus =
          u.certificationStatus !== undefined
            ? normalizeCertificationStatus(u.certificationStatus)
            : role === 'lawyer'
              ? 'none'
              : 'approved'
        const changed = role !== u.role || u.certificationStatus !== certificationStatus
        const perms = effectivePermissions(role, u.permissions ?? [])
        const permsChanged =
          perms.length !== (u.permissions?.length ?? 0) || perms.some((p, i) => p !== u.permissions?.[i])
        if (!changed && !permsChanged) return u
        usersChanged = true
        return { ...u, role, certificationStatus, permissions: perms }
      })
      if (usersChanged) localStorage.setItem('admin_users', JSON.stringify(migratedUsers))
    }

    const session = localStorage.getItem('admin_session')
    if (session) {
      try {
        const user = JSON.parse(session) as User
        const role = normalizeRole(user.role)
        const certificationStatus =
          user.certificationStatus !== undefined
            ? normalizeCertificationStatus(user.certificationStatus)
            : role === 'lawyer'
              ? 'none'
              : 'approved'
        const perms = effectivePermissions(role, user.permissions ?? [])
        const needsUpdate =
          role !== user.role ||
          user.certificationStatus !== certificationStatus ||
          perms.length !== (user.permissions?.length ?? 0) ||
          perms.some((p, i) => p !== user.permissions?.[i])
        if (needsUpdate) {
          localStorage.setItem(
            'admin_session',
            JSON.stringify({ ...user, role, certificationStatus, permissions: perms }),
          )
        }
      } catch {
        /* ignore */
      }
    }
  }

  init() {
    if (!localStorage.getItem('admin_orders')) {
      localStorage.setItem('admin_orders', JSON.stringify(DEFAULT_ORDERS));
    }
    if (!localStorage.getItem('admin_tasks')) {
      localStorage.setItem('admin_tasks', JSON.stringify(DEFAULT_TASKS));
    }
    if (!localStorage.getItem('admin_task_applications')) {
      localStorage.setItem('admin_task_applications', JSON.stringify(DEFAULT_TASK_APPLICATIONS));
    }
    if (!localStorage.getItem('admin_task_submissions')) {
      localStorage.setItem('admin_task_submissions', JSON.stringify(DEFAULT_TASK_SUBMISSIONS));
    }
    if (!localStorage.getItem('admin_logs')) {
      localStorage.setItem('admin_logs', JSON.stringify(DEFAULT_LOGS));
    }
    if (!localStorage.getItem('admin_summary')) {
      localStorage.setItem('admin_summary', JSON.stringify(DEFAULT_SUMMARY));
    }
    this.migrateLegacyRoles()
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

  getTasks(): Task[] {
    this.init();
    return JSON.parse(localStorage.getItem('admin_tasks') || '[]');
  }

  saveTasks(tasks: Task[]) {
    localStorage.setItem('admin_tasks', JSON.stringify(tasks));
  }

  getTaskApplications(): TaskApplication[] {
    this.init();
    return JSON.parse(localStorage.getItem('admin_task_applications') || '[]');
  }

  saveTaskApplications(applications: TaskApplication[]) {
    localStorage.setItem('admin_task_applications', JSON.stringify(applications));
  }

  getTaskSubmissions(): TaskSubmission[] {
    this.init();
    return JSON.parse(localStorage.getItem('admin_task_submissions') || '[]');
  }

  saveTaskSubmissions(submissions: TaskSubmission[]) {
    localStorage.setItem('admin_task_submissions', JSON.stringify(submissions));
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
      const normalized = { ...activeUser, role: normalizeRole(activeUser.role) };
      // Supabase 用户（UUID）不在本地 mock 列表，直接信任缓存
      if (normalized.id.includes('-')) {
        return normalized.status === 'active' ? normalized : null;
      }
      const users = this.getUsers();
      const dbUser = users.find((u) => u.id === normalized.id);
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
      localStorage.setItem('admin_session', JSON.stringify({ ...user, role: normalizeRole(user.role) }));
    } else {
      localStorage.removeItem('admin_session');
    }
  }
}

export const db = new LocalDb();
db.init(); // Auto boot
