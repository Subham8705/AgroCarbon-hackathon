import { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

interface Notification {
    id: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: any;
    type?: 'payout' | 'verification' | 'system';
    userId: string;
}

interface NotificationBellProps {
    isSidebar?: boolean;
}

export default function NotificationBell({ isSidebar = false }: NotificationBellProps) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user?.id) return;

        // Listen to notifications
        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', user.id),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Notification[];
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.read).length);
        });

        return () => unsubscribe();
    }, [user?.id]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isOpen &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('scroll', () => setIsOpen(false), true); // Close on scroll
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('scroll', () => setIsOpen(false), true);
        };
    }, [isOpen]);

    const markAsRead = async (notification: Notification) => {
        if (notification.read) return;
        try {
            await updateDoc(doc(db, 'notifications', notification.id), {
                read: true
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter(n => !n.read);
        const promises = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
        try {
            await Promise.all(promises);
            toast.success('All notifications marked as read');
        } catch (error) {
            console.error("Error marking all as read", error);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate();
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDropdownStyle = () => {
        if (!triggerRef.current || !isOpen) return {};
        const rect = triggerRef.current.getBoundingClientRect();

        // Default: Align top-right
        let top = rect.bottom + 8;
        let left = rect.right - 320; // 320px width

        if (isSidebar) {
            // Sidebar: Align top-left to right of button (pop out)
            top = rect.top;
            left = rect.right + 10;
        }

        // Safety check for viewport bounds
        if (left < 10) left = 10;
        if (left + 320 > window.innerWidth) left = window.innerWidth - 330;

        return {
            top: `${top}px`,
            left: `${left}px`,
            position: 'fixed' as const,
            zIndex: 9999
        };
    };

    return (
        <>
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={isSidebar
                    ? `flex items-center gap-3 px-4 py-3 rounded-lg transition-all w-full text-left relative ${isOpen ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`
                    : "relative p-2 text-muted-foreground hover:text-foreground rounded-lg transition-all"
                }
                title="Notifications"
            >
                <Bell className={isSidebar ? "w-5 h-5 shrink-0" : "w-5 h-5"} />

                {isSidebar && <span className="font-medium">Notifications</span>}

                {unreadCount > 0 && (
                    <span className={`absolute bg-red-500 rounded-full border-2 border-background animate-pulse ${isSidebar ? 'right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5' : 'top-1 right-1 w-2.5 h-2.5'}`} />
                )}
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    style={getDropdownStyle()}
                    className="w-80 bg-card border border-border shadow-xl rounded-xl overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                        <h3 className="font-bold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                            >
                                <Check className="w-3 h-3" /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No notifications yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => markAsRead(notification)}
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1">
                                                <p className={`text-sm ${!notification.read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground/70 mt-2 font-mono">
                                                    {formatDate(notification.createdAt)}
                                                </p>
                                            </div>
                                            {!notification.read && (
                                                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
