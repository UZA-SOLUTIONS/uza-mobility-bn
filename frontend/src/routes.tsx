/* eslint-disable @typescript-eslint/no-explicit-any */
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { RequirePortal } from '@/auth/RequirePortal';
import { PortalLayout } from '@/layouts/PortalLayout';
import { LENDERS, PORTALS, landingPathFor } from '@/portals/registry';
import { Spinner } from '@/components/ui';
import { Login, NoAccess } from '@/pages/Login';
import { ClientHome } from '@/pages/client/Home';
import { LenderCollateral, LenderOverview } from '@/pages/lender/Overview';
import { WorkshopBoard } from '@/pages/workshop/Board';
import { ChargingFinder } from '@/pages/charging/Finder';
import { OpsDashboard } from '@/pages/ops/Dashboard';
import { ResourceList, cells, type Column } from '@/pages/Resource';

/**
 * Routes are generated from the registry, not hand-written.
 *
 * Adding a lender is a row in LENDERS. It produces a portal, a guard, a layout, a
 * navigation set and its place in this route tree with no edit here — which is the
 * property the whole design exists to have.
 *
 * The `any` in the column definitions is deliberate and scoped to this file: these
 * rows are whatever the endpoint returns, and inventing an interface per endpoint
 * would be a second, drifting copy of the API's DTOs. Generate real types from the
 * OpenAPI document when that becomes worth doing; nothing else has to change.
 */

const list = (title: string, path: string, columns: Column<any>[]) => (
  <ResourceList<any> title={title} path={path} columns={columns} />
);

function LenderRoutes({ lenderKey }: { lenderKey: string }) {
  const lender = LENDERS.find((l) => l.key === lenderKey);
  if (!lender) return <Navigate to="/no-access" replace />;
  const base = `/financing/lenders/${lender.key}`;

  return (
    <Routes>
      <Route index element={<LenderOverview lender={lender} />} />
      <Route
        path="applications"
        element={list('Applications', `${base}/applications`, [
          { header: 'Reference', cell: (r) => cells.text(r.reference) },
          { header: 'Applicant', cell: (r) => cells.text(r.applicantName) },
          { header: 'Amount', numeric: true, cell: (r) => cells.money(r.amount) },
          { header: 'Status', cell: (r) => cells.status(r.status) },
          { header: 'Received', cell: (r) => cells.when(r.createdAt) },
        ])}
      />
      <Route
        path="borrowers"
        element={list('Borrowers', `${base}/borrowers`, [
          { header: 'UZA ID', cell: (r) => cells.text(r.uzaId) },
          { header: 'Name', cell: (r) => cells.text(r.displayName) },
          { header: 'Loan', cell: (r) => cells.text(r.loanRef) },
          { header: 'Balance', numeric: true, cell: (r) => cells.money(r.balance) },
          { header: 'Status', cell: (r) => cells.status(r.status) },
        ])}
      />
      <Route
        path="disbursements"
        element={list('Disbursements', `${base}/disbursements`, [
          { header: 'Reference', cell: (r) => cells.text(r.reference) },
          { header: 'Amount', numeric: true, cell: (r) => cells.money(r.amount) },
          { header: 'Date', cell: (r) => cells.when(r.disbursedAt) },
          { header: 'Status', cell: (r) => cells.status(r.status) },
        ])}
      />
      <Route
        path="portfolio"
        element={list('Portfolio', `${base}/portfolio`, [
          { header: 'Cohort', cell: (r) => cells.text(r.cohort) },
          { header: 'Loans', numeric: true, cell: (r) => cells.text(r.count) },
          { header: 'Outstanding', numeric: true, cell: (r) => cells.money(r.outstanding) },
          { header: 'Arrears', numeric: true, cell: (r) => cells.money(r.arrears) },
        ])}
      />
      {/*
        Mounted only when the registry entitles this lender. Without the entry there
        is no route, so the URL cannot be reached by typing it either — and the API
        refuses it a second time regardless, which is the enforcement that counts.
      */}
      {lender.seesCollateral && (
        <Route path="collateral" element={<LenderCollateral lender={lender} />} />
      )}
      <Route path="*" element={<Navigate to={`/lender/${lender.key}`} replace />} />
    </Routes>
  );
}

function PortalRoutes({ portalKey }: { portalKey: string }) {
  if (portalKey.startsWith('lender-')) {
    return <LenderRoutes lenderKey={portalKey.replace('lender-', '')} />;
  }

  switch (portalKey) {
    case 'client':
      return (
        <Routes>
          <Route index element={<ClientHome />} />
          <Route
            path="vehicle"
            element={list('My vehicle', '/fleet/my', [
              { header: 'Plate', cell: (r) => cells.text(r.plate) },
              { header: 'Make', cell: (r) => cells.text(r.make) },
              { header: 'Model', cell: (r) => cells.text(r.model) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route
            path="payments"
            element={list('Payments', '/payments/my', [
              { header: 'Reference', cell: (r) => cells.text(r.reference) },
              { header: 'Amount', numeric: true, cell: (r) => cells.money(r.amount) },
              { header: 'Date', cell: (r) => cells.when(r.createdAt) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route path="charging" element={<ChargingFinder />} />
          <Route
            path="service"
            element={list('Service & repairs', '/workshop/me/job-cards', [
              { header: 'Reference', cell: (r) => cells.text(r.reference) },
              { header: 'Vehicle', cell: (r) => cells.text(r.vehiclePlate) },
              { header: 'State', cell: (r) => cells.status(r.state) },
              { header: 'Promised', cell: (r) => cells.when(r.promisedAt) },
            ])}
          />
          <Route
            path="documents"
            element={list('Documents', '/bank-files/bottleneck', [
              { header: 'Document', cell: (r) => cells.text(r.name) },
              { header: 'Type', cell: (r) => cells.text(r.type) },
              { header: 'Uploaded', cell: (r) => cells.when(r.createdAt) },
            ])}
          />
          <Route path="*" element={<Navigate to="/client" replace />} />
        </Routes>
      );

    case 'workshop':
      return (
        <Routes>
          <Route index element={<WorkshopBoard />} />
          <Route
            path="job-cards"
            element={list('Job cards', '/workshop/job-cards', [
              { header: 'Reference', cell: (r) => cells.text(r.reference) },
              { header: 'Vehicle', cell: (r) => cells.text(r.vehiclePlate) },
              { header: 'State', cell: (r) => cells.status(r.state) },
              { header: 'Assigned', cell: (r) => cells.text(r.assignedTo) },
              { header: 'Promised', cell: (r) => cells.when(r.promisedAt) },
            ])}
          />
          <Route
            path="rescue"
            element={list('Rescue calls', '/workshop/rescue', [
              { header: 'Reference', cell: (r) => cells.text(r.reference) },
              { header: 'Fault', cell: (r) => cells.text(r.faultType) },
              { header: 'Responder', cell: (r) => cells.text(r.responderName) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route
            path="parts"
            element={list('Parts', '/parts', [
              { header: 'Part', cell: (r) => cells.text(r.name) },
              { header: 'SKU', cell: (r) => cells.text(r.sku) },
              { header: 'In stock', numeric: true, cell: (r) => cells.text(r.quantity) },
              { header: 'Price', numeric: true, cell: (r) => cells.money(r.price) },
            ])}
          />
          <Route
            path="mechanics"
            element={list('Mechanics', '/workshop/mechanics', [
              { header: 'Name', cell: (r) => cells.text(r.name) },
              { header: 'Grade', cell: (r) => cells.text(r.grade) },
              { header: 'HV certificate', cell: (r) => cells.status(r.hvCertificateStatus) },
              { header: 'Expires', cell: (r) => cells.when(r.hvCertificateExpiresAt) },
            ])}
          />
          <Route path="*" element={<Navigate to="/workshop" replace />} />
        </Routes>
      );

    case 'charging':
      return (
        <Routes>
          <Route index element={<ChargingFinder />} />
          <Route
            path="bookings"
            element={list('My bookings', '/charging-stations/stations/my', [
              { header: 'Station', cell: (r) => cells.text(r.stationName) },
              { header: 'Connector', cell: (r) => cells.text(r.connectorId) },
              { header: 'Held until', cell: (r) => cells.when(r.expiresAt) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route
            path="stations"
            element={list('Stations', '/charging-stations/stations/my', [
              { header: 'Name', cell: (r) => cells.text(r.name) },
              { header: 'City', cell: (r) => cells.text(r.city) },
              { header: 'Connectors', numeric: true, cell: (r) => cells.text(r.totalPorts) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route path="*" element={<Navigate to="/charging" replace />} />
        </Routes>
      );

    case 'ops':
      return (
        <Routes>
          <Route index element={<OpsDashboard />} />
          <Route
            path="listings"
            element={list('Listings', '/admin/listings', [
              { header: 'Title', cell: (r) => cells.text(r.title) },
              { header: 'Seller', cell: (r) => cells.text(r.sellerName) },
              { header: 'Price', numeric: true, cell: (r) => cells.money(r.price) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route
            path="orders"
            element={list('Orders', '/admin/orders', [
              { header: 'Reference', cell: (r) => cells.text(r.reference) },
              { header: 'Buyer', cell: (r) => cells.text(r.buyerName) },
              { header: 'Total', numeric: true, cell: (r) => cells.money(r.total) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
              { header: 'Placed', cell: (r) => cells.when(r.createdAt) },
            ])}
          />
          <Route
            path="financing"
            element={list('Financing', '/admin/financing', [
              { header: 'Reference', cell: (r) => cells.text(r.reference) },
              { header: 'Applicant', cell: (r) => cells.text(r.applicantName) },
              { header: 'Lender', cell: (r) => cells.text(r.lender) },
              { header: 'Amount', numeric: true, cell: (r) => cells.money(r.amount) },
              { header: 'Status', cell: (r) => cells.status(r.status) },
            ])}
          />
          <Route
            path="people"
            element={list('People', '/admin/users', [
              { header: 'Name', cell: (r) => cells.text([r.firstName, r.lastName].filter(Boolean).join(' ')) },
              { header: 'Email', cell: (r) => cells.text(r.email) },
              { header: 'Roles', cell: (r) => cells.text((r.roles ?? []).join(', ')) },
              { header: 'Joined', cell: (r) => cells.when(r.createdAt) },
            ])}
          />
          <Route path="*" element={<Navigate to="/ops" replace />} />
        </Routes>
      );

    default:
      return <Navigate to="/no-access" replace />;
  }
}

/** Signed in: their first portal. Signed out: the login form. */
function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Loading" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={landingPathFor(user.roles) ?? '/no-access'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/no-access" element={<NoAccess />} />
      <Route path="/" element={<Landing />} />

      {PORTALS.map((portal) => (
        <Route key={portal.key} element={<RequirePortal portal={portal} />}>
          <Route path={`${portal.basePath}/*`} element={<PortalLayout portal={portal} />}>
            <Route path="*" element={<PortalRoutes portalKey={portal.key} />} />
          </Route>
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
