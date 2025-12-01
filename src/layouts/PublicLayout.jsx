import React from 'react';
import { Outlet } from 'react-router-dom';

const PublicLayout = () => {
  console.log('🌐 PublicLayout render');
  return (
    <div>
      <Outlet />
    </div>
  );
};

export default PublicLayout;