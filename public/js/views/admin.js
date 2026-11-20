// 관리자: 현황 · 교사 승인 · 학교(기관) 인증 코드
import { api } from '../api.js';
import { h, clear, toast, toastError, promptDialog, fmtDate } from '../ui.js';
import { shell } from '../app.js';

const STATUS = { pending: ['승인 대기', 'warn'], active: ['사용 중', 'ok'], disabled: ['중지', 'danger'] };

export async function adminPage() {
  const [ov, teachers, schools] = await Promise.all([api.get('/admin/overview'), api.get('/admin/teachers'), api.get('/admin/schools')]);
  const teacherBox = h('div');
  const schoolBox = h('div');

  const renderTeachers = () => {
    clear(teacherBox).append(
      h('div', { class: 'table-wrap' },
        h('table', { class: 'table' },
          h('thead', null, h('tr', null, h('th', null, '이름'), h('th', null, '이메일'), h('th', null, '학교'), h('th', null, '학급'), h('th', null, '가입일'), h('th', null, '상태'), h('th', null, ''))),
          h('tbody', null,
            teachers.map((t) =>
              h('tr', null,
                h('td', null, h('b', null, t.name), t.role === 'admin' ? h('span', { class: 'badge primary', style: { marginLeft: '6px' } }, '관리자') : null),
                h('td', { class: 'small' }, t.email),
                h('td', { class: 'small' }, t.school_name || '-'),
                h('td', { class: 'num' }, t.class_count),
                h('td', { class: 'small' }, fmtDate(t.created_at)),
                h('td', null, h('span', { class: `badge ${STATUS[t.status][1]}` }, STATUS[t.status][0])),
                h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
                  t.role === 'admin'
                    ? null
                    : [
                        t.status !== 'active' ? h('button', { class: 'btn sm primary', onclick: () => setStatus(t, 'active') }, '승인') : null,
                        ' ',
                        t.status === 'active' ? h('button', { class: 'btn sm danger', onclick: () => setStatus(t, 'disabled') }, '중지') : null,
                      ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  };
  const setStatus = async (t, status) => {
    try {
      await api.post(`/admin/teachers/${t.id}/status`, { status });
      t.status = status;
      renderTeachers();
      toast(status === 'active' ? `${t.name} 선생님을 승인했어요` : '사용을 중지했어요', 'ok');
    } catch (ex) {
      toastError(ex);
    }
  };

  const renderSchools = () => {
    clear(schoolBox).append(
      schools.length
        ? h('div', { class: 'table-wrap' },
            h('table', { class: 'table' },
              h('thead', null, h('tr', null, h('th', null, '학교(기관)'), h('th', null, '인증 코드'), h('th', null, '교사'), h('th', null, '상태'), h('th', null, ''))),
              h('tbody', null,
                schools.map((s) =>
                  h('tr', null,
                    h('td', null, h('b', null, s.name)),
                    h('td', null, h('span', { class: 'pin' }, s.invite_code)),
                    h('td', { class: 'num' }, s.teacher_count),
                    h('td', null, s.active ? h('span', { class: 'badge ok' }, '사용') : h('span', { class: 'badge' }, '중지')),
                    h('td', { style: { textAlign: 'right', whiteSpace: 'nowrap' } },
                      h('button', { class: 'btn sm', onclick: () => patchSchool(s, { regenerate: true }) }, '코드 재발급'),
                      ' ',
                      h('button', { class: 'btn sm', onclick: () => patchSchool(s, { active: !s.active }) }, s.active ? '중지' : '사용'),
                    ),
                  ),
                ),
              ),
            ),
          )
        : h('p', { class: 'muted' }, '등록된 학교가 없어요. 학교를 추가하면 인증 코드가 만들어지고, 그 코드로 가입한 선생님은 바로 사용할 수 있어요.'),
    );
  };
  const patchSchool = async (s, patch) => {
    try {
      Object.assign(s, await api.patch(`/admin/schools/${s.id}`, patch));
      renderSchools();
    } catch (ex) {
      toastError(ex);
    }
  };

  renderTeachers();
  renderSchools();
  const stat = (label, v) => h('div', { class: 'card flat stat' }, h('span', { class: 'stat-label' }, label), h('span', { class: 'stat-val' }, v));
  return shell(
    h('div', null,
      h('h1', null, '관리'),
      h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' } },
        stat('승인 대기', ov.pending),
        stat('선생님', ov.teachers),
        stat('학교', ov.schools),
        stat('학급', ov.classes),
        stat('학생', ov.students),
        stat('제출 작품', ov.artworks),
        stat('마음 탐색', ov.psych),
      ),
      ov.aiAvailable ? null : h('div', { class: 'notice warn mt' }, 'AI 키(ANTHROPIC_API_KEY)가 설정되지 않아 AI 주제 도안과 AI 요약이 꺼져 있어요. .env 파일에 키를 넣고 서버를 다시 시작하세요.'),
      h('div', { class: 'row between mt-lg' }, h('h2', { style: { margin: 0 } }, '학교(기관) 인증 코드'), h('button', { class: 'btn primary', onclick: async () => {
        const name = await promptDialog('학교(기관) 추가', { label: '이름', placeholder: '예) 미아트초등학교', okLabel: '추가' });
        if (!name) return;
        try {
          schools.unshift({ ...(await api.post('/admin/schools', { name })), active: 1, teacher_count: 0 });
          renderSchools();
        } catch (ex) {
          toastError(ex);
        }
      } }, '+ 학교 추가')),
      h('div', { class: 'mt' }, schoolBox),
      h('h2', { class: 'mt-lg' }, '선생님 계정'),
      teacherBox,
    ),
    { active: 'admin' },
  );
}
