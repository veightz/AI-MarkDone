import { beforeEach, describe, expect, it } from 'vitest';
import { PageAnnotationMarkers } from '@/ui/content/pageAnnotations/PageAnnotationMarkers';
import { createAppearanceSnapshot } from '@/style/appearance';

function mountRoot(): HTMLElement {
    const message = document.createElement('div');
    message.innerHTML = '<div class="markdown prose"><p>Hello world</p></div>';
    document.body.appendChild(message);
    return message.querySelector('.markdown.prose') as HTMLElement;
}

describe('PageAnnotationMarkers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('renders highlights and anchors inside the message root and scrolls with it', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        const onOpen = () => undefined;

        markers.render([{
            root,
            highlights: [{ left: 4, top: 6, width: 80, height: 18 }],
            anchors: [{ id: 'c1', left: 92, top: 7, active: false, label: 'Open annotation', onOpen }],
        }]);

        const host = root.querySelector<HTMLElement>('[data-aimd-role="chatgpt-page-annotation-markers"]');
        expect(host).toBeTruthy();
        expect(host!.isConnected).toBe(true);
        const shadow = host!.shadowRoot!;
        expect(shadow.querySelectorAll('.reader-comment-highlight')).toHaveLength(1);
        expect(shadow.querySelectorAll('.reader-comment-anchor')).toHaveLength(1);
        const anchor = shadow.querySelector<HTMLButtonElement>('.reader-comment-anchor');
        expect(anchor?.getAttribute('aria-label')).toBe('Open annotation');
        expect(anchor?.getAttribute('title')).toBe('Open annotation');
        markers.dispose();
    });

    it('never duplicates markers when re-rendered repeatedly (scroll/refresh safety)', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));

        for (let index = 0; index < 5; index += 1) {
            markers.render([{
                root,
                highlights: [{ left: 4, top: 6, width: 80, height: 18 }],
                anchors: [{ id: 'c1', left: 92, top: 7, active: false, onOpen: () => undefined }],
            }]);
        }

        const hosts = root.querySelectorAll<HTMLElement>('[data-aimd-role="chatgpt-page-annotation-markers"]');
        expect(hosts).toHaveLength(1);
        expect(hosts[0]!.shadowRoot!.querySelectorAll('.reader-comment-anchor')).toHaveLength(1);
        expect(hosts[0]!.shadowRoot!.querySelectorAll('.reader-comment-highlight')).toHaveLength(1);
        markers.dispose();
    });

    it('updates marker coordinates when the host offset changes without a record change', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        let rootTop = 0;
        Object.assign(root, {getBoundingClientRect: () => ({left:0,top:rootTop,width:300,height:100,right:300,bottom:rootTop+100})});
        const item = {root, highlights:[{left:10,top:12,width:50,height:15,color:'blue' as const}],anchors:[],signature:'same-record'};
        markers.render([item]);
        const host = root.querySelector<HTMLElement>('[data-aimd-role="chatgpt-page-annotation-markers"]')!;
        Object.assign(host, {getBoundingClientRect: () => ({left:0,top:0,width:300,height:0,right:300,bottom:0})});
        rootTop = 20;
        markers.render([item]);
        expect(host.shadowRoot!.querySelector<HTMLElement>('.reader-comment-highlight')?.style.top).toBe('32px');
        markers.dispose();
    });

    it('renders a small noninteractive color marker beside the annotation control', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        markers.render([{
            root,
            highlights: [{ left: 4, top: 6, width: 80, height: 18, color: 'yellow' }],
            anchors: [
                { id: 'comment', left: 92, top: 7, active: false, onOpen: () => undefined },
                { id: 'highlight', kind: 'highlight', color: 'yellow', left: 100, top: 42 },
            ],
        }]);
        const shadow = root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')!.shadowRoot!;
        expect(shadow.querySelectorAll('.reader-comment-anchor')).toHaveLength(1);
        const chip = shadow.querySelector<HTMLElement>('.reader-highlight-anchor');
        expect(chip?.dataset.color).toBe('yellow');
        expect(chip?.getAttribute('aria-label')).toBeTruthy();
        expect(chip?.style.top).toBe('42px');
        expect(chip?.matches('button')).toBe(false);
        markers.dispose();
    });

    it('composites the marker host with body text instead of covering the glyphs', () => {
        const root = mountRoot(); const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        markers.render([{root, highlights:[{left:0,top:0,width:50,height:20,color:'yellow'}],anchors:[]}]);
        const css = root.querySelector('[data-aimd-role]')!.shadowRoot!.textContent;
        expect(css).toContain('mix-blend-mode: var(--aimd-highlight-blend-mode)');
        expect(css).toContain('--aimd-sys-highlight-blend-mode: multiply');
        markers.setAppearance(createAppearanceSnapshot('dark'));
        expect(root.querySelector('[data-aimd-role]')!.shadowRoot!.textContent).toContain('--aimd-sys-highlight-blend-mode: screen');
        markers.dispose();
    });

    it('removes the host when a root no longer has annotations', () => {
        const root = mountRoot();
        const markers = new PageAnnotationMarkers(createAppearanceSnapshot('light'));
        markers.render([{
            root,
            highlights: [],
            anchors: [{ id: 'c1', left: 10, top: 10, active: false, onOpen: () => undefined }],
        }]);
        expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')).toBeTruthy();

        markers.render([]);
        expect(root.querySelector('[data-aimd-role="chatgpt-page-annotation-markers"]')).toBeNull();
        markers.dispose();
    });
});
