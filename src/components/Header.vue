<template>
    <header
        class="w-full top-0 left-0 z-50 border-b border-border border-dashed backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div class="container-wrapper">
            <div class="flex h-14 items-center px-4">
                <div class="mr-4 md:mr-1">
                    <router-link to="/" class="mr-4 md:mr-2 lg:mr-6 flex items-center lg:space-x1 xl:space-x-2">
                        <AppIcon /><span class="font-bold">PulseCheck</span>
                    </router-link>
                </div>
                <nav class="flex items-center gap-4 text-sm !mb-0">
                    <router-link to="/" class="transition-colors hover:text-primary text-muted-foreground">Home</router-link>
                    <router-link to="/add-monitor" class="transition-colors hover:text-primary text-muted-foreground">Add Monitor</router-link>
                </nav>
            </div>
        </div>
    </header>
</template>

<script>
import AppIcon from './AppIcon.vue';

export default {
    components: {
        AppIcon
    }
};
</script>