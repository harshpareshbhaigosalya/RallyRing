import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: any) {
    try {
        if (navigationRef.isReady()) {
            (navigationRef as any).navigate(name, params);
        } else {
            console.warn(`Navigation Ref not ready for: ${name}`);
        }
    } catch (error) {
        console.error("Navigation Error:", error);
    }
}
