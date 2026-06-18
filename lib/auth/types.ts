import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    role: 'admin' | 'sales_lead' | 'bda';
    assignedProjectIds: string[];
  }

  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: 'admin' | 'sales_lead' | 'bda';
      assignedProjectIds: string[];
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'admin' | 'sales_lead' | 'bda';
    assignedProjectIds: string[];
  }
}
