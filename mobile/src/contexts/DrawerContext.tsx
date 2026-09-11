import React, { createContext, useContext, useState } from 'react';

interface DrawerContextType {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  isNotificationsOpen: boolean;
  openNotifications: () => void;
  closeNotifications: () => void;
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

const DrawerContext = createContext<DrawerContextType>({
  isDrawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  toggleDrawer: () => {},
  isNotificationsOpen: false,
  openNotifications: () => {},
  closeNotifications: () => {},
  unreadCount: 3,
  setUnreadCount: () => {},
});

export const DrawerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);

  const openNotifications = () => {
    setIsNotificationsOpen(true);
    setUnreadCount(0); // clear unread count on open
  };
  const closeNotifications = () => setIsNotificationsOpen(false);

  return (
    <DrawerContext.Provider
      value={{
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        isNotificationsOpen,
        openNotifications,
        closeNotifications,
        unreadCount,
        setUnreadCount,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );
};

export const useDrawer = () => useContext(DrawerContext);
