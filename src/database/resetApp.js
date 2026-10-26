import AsyncStorage from '@react-native-async-storage/async-storage';
import database from './index';

export const resetAppIfNeeded = async () => {
    try {
        const installed = await AsyncStorage.getItem('app_installed');
        console.log(installed, 'installed')
        if (!installed) {
            console.log("First install detected → resetting DB", installed);

            await database.write(async () => {
                await database.unsafeResetDatabase();
            });

            await AsyncStorage.clear();

            await AsyncStorage.setItem('app_installed', 'true');
        }
    } catch (error) {
        console.log('Reset error:', error);
    }
};