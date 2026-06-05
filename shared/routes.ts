
import { z } from 'zod';
import { 
  insertTenantSchema, 
  insertProfileSchema, 
  insertBoardSchema, 
  insertColumnSchema, 
  insertItemSchema,
  tenants,
  profiles,
  boards,
  columns,
  items,
  modules
} from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  tenants: {
    list: {
      method: 'GET' as const,
      path: '/api/tenants',
      responses: {
        200: z.array(z.custom<typeof tenants.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/tenants',
      input: insertTenantSchema,
      responses: {
        201: z.custom<typeof tenants.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/tenants/:id',
      responses: {
        200: z.custom<typeof tenants.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
  modules: {
    list: {
      method: 'GET' as const,
      path: '/api/modules',
      responses: {
        200: z.array(z.custom<typeof modules.$inferSelect>()),
      },
    }
  },
  boards: {
    list: {
      method: 'GET' as const,
      path: '/api/boards',
      input: z.object({
        tenantId: z.string().optional(),
        moduleId: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof boards.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/boards',
      input: insertBoardSchema,
      responses: {
        201: z.custom<typeof boards.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/boards/:id',
      responses: {
        200: z.custom<typeof boards.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
  columns: {
    list: {
      method: 'GET' as const,
      path: '/api/boards/:boardId/columns',
      responses: {
        200: z.array(z.custom<typeof columns.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/boards/:boardId/columns',
      input: insertColumnSchema.omit({ boardId: true }),
      responses: {
        201: z.custom<typeof columns.$inferSelect>(),
        400: errorSchemas.validation,
      },
    }
  },
  items: {
    list: {
      method: 'GET' as const,
      path: '/api/boards/:boardId/items',
      responses: {
        200: z.array(z.custom<typeof items.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/boards/:boardId/items',
      input: insertItemSchema.omit({ boardId: true }),
      responses: {
        201: z.custom<typeof items.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/items/:id',
      input: insertItemSchema.partial(),
      responses: {
        200: z.custom<typeof items.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/items/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
