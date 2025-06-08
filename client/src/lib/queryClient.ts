import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const validateScreenshotData = (imageData: string): { isValid: boolean; error?: string; correctedData?: string } => {
  if (!imageData || typeof imageData !== 'string') {
    return { isValid: false, error: 'Image data is missing or not a string' };
  }
  
  if (imageData.length === 0) {
    return { isValid: false, error: 'Image data is empty' };
  }
  
  // Check if it has proper data URI prefix
  if (imageData.startsWith('data:image/')) {
    return { isValid: true, correctedData: imageData };
  }
  
  // If it looks like base64 but missing prefix, try to correct it
  if (imageData.match(/^[A-Za-z0-9+/]+=*$/)) {
    const correctedData = `data:image/jpeg;base64,${imageData}`;
    return { 
      isValid: true, 
      correctedData, 
      error: 'Added missing data URI prefix'
    };
  }
  
  return { 
    isValid: false, 
    error: 'Invalid image format - not a valid data URI or base64 string' 
  };
};

// Debug function to manually test image rendering
export const testImageData = (imageData: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      console.log('✅ Test image loaded successfully');
      resolve(true);
    };
    img.onerror = () => {
      console.error('❌ Test image failed to load');
      resolve(false);
    };
    img.src = imageData;
  });
};
