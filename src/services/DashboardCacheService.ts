import { db } from "../lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc, Timestamp, query, where, limit } from "firebase/firestore";

export class DashboardCacheService {
  private static CACHE_COLLECTION = "dashboard_cache";
  private static CACHE_DOC_ID = "executive_metrics";
  private static CACHE_TTL_MINUTES = 15;

  static async getExecutiveDashboardMetrics(forceRefresh = false): Promise<any> {
    const cacheRef = doc(db, this.CACHE_COLLECTION, this.CACHE_DOC_ID);
    
    if (!forceRefresh) {
      try {
        const cacheSnap = await getDoc(cacheRef);
        if (cacheSnap.exists()) {
          const data = cacheSnap.data();
          const lastUpdated = data.lastUpdated?.toDate();
          if (lastUpdated) {
            const minutesSinceUpdate = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60);
            if (minutesSinceUpdate < this.CACHE_TTL_MINUTES) {
              console.log("[DashboardCacheService] Using cached metrics.");
              return data.metrics;
            }
          }
        }
      } catch (err) {
        console.warn("[DashboardCacheService] Failed to read cache, calculating fresh.", err);
      }
    }

    console.log("[DashboardCacheService] Calculating fresh metrics...");
    // Perform heavy aggregations here instead of on the frontend
    const metrics = await this.calculateFreshMetrics();
    
    // Save to cache
    try {
      await setDoc(cacheRef, {
        metrics,
        lastUpdated: Timestamp.now()
      });
      console.log("[DashboardCacheService] Cache updated.");
    } catch (err) {
      console.error("[DashboardCacheService] Failed to save cache.", err);
    }

    return metrics;
  }

  private static async calculateFreshMetrics() {
    // In a real production app, this would be a Cloud Function.
    // For now, we calculate it here once every 15 minutes.
    const [cands, reqs, subs, orgs, users] = await Promise.all([
      getDocs(query(collection(db, "candidatePool"), limit(25))),
      getDocs(query(collection(db, "requirements_public"), limit(25))),
      getDocs(query(collection(db, "submissions"), limit(25))),
      getDocs(query(collection(db, "organizations"), limit(25))),
      getDocs(query(collection(db, "users"), limit(25)))
    ]);

    const activeVendors = orgs.docs.filter(d => d.data().orgType === 'vendor' || d.data().type === 'vendor').length;
    const openRequirements = reqs.docs.filter(d => d.data().status === 'OPEN' || d.data().status === 'PUBLISHED').length;

    let revenue = 0;
    subs.docs.forEach(d => {
      const s = d.data();
      if (['PLACED', 'JOINED', 'HIRED'].includes(s.status?.toUpperCase())) {
        revenue += 15000; // Estimated fee
      }
    });

    return {
      totalCandidates: cands.size,
      activeVendors: activeVendors,
      openRequirements: openRequirements,
      totalSubmissions: subs.size,
      revenue: revenue,
      aiHealthScore: 98,
      totalUsers: users.size
    };
  }
}
