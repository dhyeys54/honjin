import { startHerdr } from '../honjin-core/test/herdr-harness';

export default async function globalSetup(): Promise<() => Promise<void>> {
    const herdr = await startHerdr({ session: process.env.HONJIN_E2E_SESSION });
    return () => herdr.stop();
}
