import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),

		sveltekit(),

		VitePWA({
			registerType: 'autoUpdate',

			manifest: {
				name: 'Namaz Vakitleri',
				short_name: 'Namaz',

				description:
					'Namaz vakitleri ve günlük hadis uygulaması',

				theme_color: '#000000',

				background_color: '#000000',

				display: 'standalone',

				start_url: '/',

				icons: [
					{
						src: '/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				]
			}
		})
	]
});