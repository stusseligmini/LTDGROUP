import { createYoga } from 'graphql-yoga';
import { schema } from '@/lib/graphql/schema';
import { prisma } from '@/server/db/client';
import { getUserFromRequest } from '@/lib/auth/serverAuth';
import { NextRequest } from 'next/server';

// Create GraphQL Yoga server
const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  context: async ({ request }: { request: Request }) => {
    try {
      // Convert standard Request to Next.js request for auth
      // Important: Copy cookies from request headers
      const url = new URL(request.url);
      
      // Get cookies from request
      const cookieHeader = request.headers.get('cookie') || '';
      
      // Create headers object with cookies
      const headers = new Headers(request.headers);
      if (cookieHeader) {
        headers.set('cookie', cookieHeader);
      }
      
      // Create NextRequest with proper cookie handling
      const nextRequest = new NextRequest(url, {
        method: request.method,
        headers: headers as any,
      });
      
      // Copy cookies explicitly if they weren't preserved
      // Check for Firebase auth cookies
      if (cookieHeader && !nextRequest.cookies.has('firebase-id-token') && !nextRequest.cookies.has('firebase-auth-token')) {
        // Parse cookies manually if needed
        cookieHeader.split(';').forEach((cookie) => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) {
            nextRequest.cookies.set(name, value);
          }
        });
      }
      
      // Get authenticated user (Firebase Auth)
      let user;
      try {
        user = await getUserFromRequest(nextRequest);
      } catch (error) {
        // Log error but don't fail - allow unauthenticated requests to fail gracefully in resolvers
        if (process.env.NODE_ENV === 'development') {
          console.error('[GraphQL Context] Auth error:', error);
        }
        user = null;
      }
      
      // Map auth.uid to our userId for Firebase GraphQL compatibility
      // IMPORTANT: We map auth.uid directly here - we don't evaluate CEL expressions
      // When resolver sees id_expr: "auth.uid", it should use this userId
      const userId = user?.id || null;
      
      return {
        prisma,
        userId,
        user,
        // Make userId available as authUid for Firebase GraphQL compatibility
        authUid: userId,
        // Also expose as auth.uid for resolver compatibility (NOT CEL evaluation)
        // This is just a helper object - we don't evaluate CEL expressions
        auth: userId ? { uid: userId } : null,
      };
    } catch (error) {
      // Log error for debugging
      console.error('GraphQL context error:', error);
      return {
        prisma,
        userId: null,
        user: null,
        authUid: null,
        auth: null,
      };
    }
  },
  // Enable GraphiQL in development
  // For custom tabs (Authentication, Variables, Query/Mutation), use /graphql page instead
  graphiql: process.env.NODE_ENV === 'development' ? {
    title: 'Celora GraphQL API',
    defaultQuery: `# Bruk /graphql for custom tabs (Authentication, Variables, Query/Mutation)
# Eller bruk denne standard GraphiQL med innebygd Variables tab

query {
  me {
    id
    email
    displayName
  }
}`,
  } : false,
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || '*',
    credentials: true,
  },
});

// Next.js route handlers - convert NextRequest to standard Request
export async function GET(request: NextRequest) {
  // Create a standard Request from NextRequest
  // Important: Preserve cookies for authentication
  const url = new URL(request.url);
  
  // Get all headers including cookies
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });
  
  // Ensure cookies are included
  const cookieHeader = request.cookies.toString();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  
  const standardRequest = new Request(url, {
    method: request.method,
    headers: headers,
  });
  
  return yoga.fetch(standardRequest);
}

export async function POST(request: NextRequest) {
  // Create a standard Request from NextRequest
  // Important: Preserve cookies for authentication
  const url = new URL(request.url);
  const body = await request.text();
  
  // Get all headers including cookies
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    headers.set(key, value);
  });
  
  // Ensure cookies are included
  const cookieHeader = request.cookies.toString();
  if (cookieHeader) {
    headers.set('cookie', cookieHeader);
  }
  
  const standardRequest = new Request(url, {
    method: request.method,
    headers: headers,
    body: body || undefined,
  });
  
  return yoga.fetch(standardRequest);
}


