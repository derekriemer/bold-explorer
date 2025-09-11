import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import MultiSelectWizard from '@/components/MultiSelectWizard.vue';
import type { MultiSelectConfig, MultiSelectItem } from '@/types/multi-select';

function ionStubs() {
  const pass = (name: string, tag = 'div', cls?: string) => ({
    name,
    template: `<${tag} ${cls ? `class=\"${cls}\"` : ''}><slot></slot></${tag}>`
  });
  return {
    IonModal: pass('IonModal'),
    IonHeader: pass('IonHeader'),
    IonToolbar: pass('IonToolbar'),
    IonTitle: pass('IonTitle'),
    IonButtons: pass('IonButtons'),
    IonContent: pass('IonContent'),
    IonList: pass('IonList', 'ul'),
    IonItem: pass('IonItem', 'li', 'ion-item'),
    IonLabel: pass('IonLabel', 'span'),
    // Simple button that emits click
    IonButton: { template: `<button @click="$emit('click', $event)"><slot></slot></button>` },
    // Minimal checkbox stub (we won't rely on DOM toggling, but keep disabled attribute visible)
    IonCheckbox: { props: ['disabled', 'checked'], template: `<input type="checkbox" :disabled="disabled" :checked="checked" />` },
    // Searchbar placeholder
    IonSearchbar: { template: `<div><slot></slot></div>` }
  } as any;
}

async function mountWizard(items: MultiSelectItem[], commitMock = vi.fn()) {
  const config: MultiSelectConfig = {
    title: 'Add Things',
    getItems: async () => items,
    commit: commitMock,
    ctaLabel: 'Add Selected'
  };
  const wrapper = mount(MultiSelectWizard, {
    props: { open: true, config },
    global: { stubs: ionStubs() }
  });
  // Wait for initial load
  await Promise.resolve();
  await wrapper.vm.$nextTick();
  return { wrapper, commitMock };
}

describe('MultiSelectWizard', () => {
  const sample: MultiSelectItem[] = [
    { id: 1, label: 'Alpha', sublabel: 'A desc' },
    { id: 2, label: 'Beta', sublabel: 'B desc' },
    { id: 3, label: 'Gamma', sublabel: 'G desc', disabled: true }
  ];

  it('loads and displays items and sublabels', async () => {
    const { wrapper } = await mountWizard(sample);
    const items = wrapper.findAll('.ion-item');
    expect(items.length).toBe(3);
    expect(wrapper.text()).toContain('Alpha');
    expect(wrapper.text()).toContain('A desc');
    expect(wrapper.text()).toContain('Beta');
    expect(wrapper.text()).toContain('B desc');
  });

  it('filters by query (case-insensitive)', async () => {
    const { wrapper } = await mountWizard(sample);
    // Set internal query and verify filtered rendering
    (wrapper.vm as any).query = 'beta';
    await wrapper.vm.$nextTick();
    const items = wrapper.findAll('.ion-item');
    expect(items.length).toBe(1);
    expect(wrapper.text()).toContain('Beta');
  });

  it('commits selected ids and emits events', async () => {
    const { wrapper, commitMock } = await mountWizard(sample);
    // Select two items
    (wrapper.vm as any).toggle(1);
    (wrapper.vm as any).toggle(2);
    await (wrapper.vm as any).onCommit();
    expect(commitMock).toHaveBeenCalledTimes(1);
    const arg = commitMock.mock.calls[0][0] as number[];
    expect(arg).toEqual(expect.arrayContaining([1, 2]));
    expect(arg.length).toBe(2);
    // Emitted done count and closed modal
    expect(wrapper.emitted('done')?.[0]?.[0]).toBe(2);
    expect(wrapper.emitted('update:open')?.[0]?.[0]).toBe(false);
  });

  it('Select All selects only enabled items; Clear removes all', async () => {
    const commitSpy = vi.fn();
    const { wrapper } = await mountWizard(sample, commitSpy);
    const btns = wrapper.findAll('button');
    const selectAll = btns.find(b => b.text() === 'Select All');
    const clear = btns.find(b => b.text() === 'Clear');
    expect(selectAll && clear).toBeTruthy();
    await selectAll!.trigger('click');
    await (wrapper.vm as any).onCommit();
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const ids = commitSpy.mock.calls[0][0] as number[];
    expect(ids.sort()).toEqual([1, 2]); // id 3 is disabled

    // Now clear and ensure no selection commits
    commitSpy.mockReset();
    await clear!.trigger('click');
    await (wrapper.vm as any).onCommit();
    expect(commitSpy).not.toHaveBeenCalled();
  });
});
