export class VendorService {
  async search(params: { name?: string, tier?: string }) {
    return {
      vendors: [
        { id: 'v-1', name: 'Acme Staffing', tier: 'GOLD' },
        { id: 'v-2', name: 'Global Talent', tier: 'SILVER' }
      ]
    };
  }

  async getTrustScore(vendorId: string) {
    return {
      vendorId,
      trustScore: 92,
      factors: {
        submissionQuality: 95,
        responsiveness: 88,
        compliance: 100
      }
    };
  }
}
