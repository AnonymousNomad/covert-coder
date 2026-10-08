import { RouteError, type Route, type RouteContext } from '../server.ts';
import { AuthorityPairRequest, AuthoritySessionResponse, AuthorityDecisionRequest, AuthorityDecisionResponse,
  AuthorityOperationResponse, AuthorityPrepareRequest, AuthorityInspectQuery } from '../../../common/contracts/authority.ts';
import { PartnerDeviceList, PartnerDevicePrincipal, PartnerDeviceRevokeRequest,
  PartnerPairingApprovalRequest, PartnerPairingChallengeRequest, PartnerPairingPendingList,
  PartnerPairingRejectionRequest, PartnerPairingRejectionResponse, PairingChallenge } from '../../../common/contracts/partner.ts';

function service(ctx: RouteContext) {
  if (!ctx.authority) throw new RouteError('NOT_READY', 'execution authority is not connected');
  return ctx.authority;
}
function actor(ctx: RouteContext) {
  if (!ctx.actor) throw new RouteError('FORBIDDEN', 'authenticated actor required');
  return ctx.actor;
}
export function routesForAuthority(): Route[] {
  return [
    { method: 'POST', path: '/api/authority/pair', authorityMode: 'pair', body: AuthorityPairRequest, response: AuthoritySessionResponse,
      handler: ctx => service(ctx).pair((ctx.body as { proof: string }).proof, ctx.origin ?? '') },
    { method: 'POST', path: '/api/authority/prepare', authorityMode: 'control', body: AuthorityPrepareRequest, response: AuthorityOperationResponse,
      handler: ctx => {
        actor(ctx);
        if (!ctx.prepareOperation) throw new RouteError('NOT_READY', 'operation adapter unavailable');
        return ctx.prepareOperation(AuthorityPrepareRequest.parse(ctx.body));
      } },
    { method: 'POST', path: '/api/authority/decision', authorityMode: 'control', body: AuthorityDecisionRequest, response: AuthorityDecisionResponse,
      handler: async ctx => {
        const input = AuthorityDecisionRequest.parse(ctx.body);
        return { operation: await service(ctx).decide(actor(ctx), input.operation_id, input.decision) };
      } },
    { method: 'GET', path: '/api/authority/operation', authorityMode: 'control', query: AuthorityInspectQuery, response: AuthorityOperationResponse,
      handler: ctx => service(ctx).inspect(actor(ctx), AuthorityInspectQuery.parse(ctx.query).id) },
    { method: 'POST', path: '/api/partner/pairings/challenge', authorityMode: 'control', body: PartnerPairingChallengeRequest, response: PairingChallenge,
      handler: ctx => service(ctx).control.createPartnerPairingChallenge(actor(ctx), PartnerPairingChallengeRequest.parse(ctx.body).requested_scopes) },
    { method: 'GET', path: '/api/partner/pairings/pending', authorityMode: 'control', response: PartnerPairingPendingList,
      handler: async ctx => ({ pairings: await service(ctx).control.pendingPartnerPairings(actor(ctx)) }) },
    { method: 'POST', path: '/api/partner/pairings/confirm', authorityMode: 'control', body: PartnerPairingApprovalRequest, response: PartnerDevicePrincipal,
      handler: ctx => {
        const input = PartnerPairingApprovalRequest.parse(ctx.body);
        return service(ctx).control.confirmPartnerPairing(actor(ctx), input.pending_id, input.approved_scopes);
      } },
    { method: 'POST', path: '/api/partner/pairings/reject', authorityMode: 'control', body: PartnerPairingRejectionRequest,
      response: PartnerPairingRejectionResponse,
      handler: ctx => service(ctx).control.rejectPartnerPairing(actor(ctx), PartnerPairingRejectionRequest.parse(ctx.body).pending_id) },
    { method: 'GET', path: '/api/partner/devices', authorityMode: 'control', response: PartnerDeviceList,
      handler: async ctx => ({ devices: await service(ctx).control.listPartnerDevices(actor(ctx)) }) },
    { method: 'POST', path: '/api/partner/devices/revoke', authorityMode: 'control', body: PartnerDeviceRevokeRequest, response: PartnerDevicePrincipal,
      handler: ctx => service(ctx).control.revokePartnerDevice(actor(ctx), PartnerDeviceRevokeRequest.parse(ctx.body).device_id) }
  ];
}
