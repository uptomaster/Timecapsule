// src/main.ts - 최종 완성본

import { supabase } from './lib/supabase.ts'
import { renderLoginForm } from './components/LoginForm.ts'
import { renderCreateCapsuleForm } from './components/CreateCapsuleForm.ts'
import { getCurrentUser, signOut } from './lib/auth.ts'
import { decrypt } from './lib/crypto.ts'

const capsuleList = document.getElementById('capsule-list') as HTMLDivElement | null
const ITEMS_PER_PAGE = 9

function maskEmail(email: string): string {
  if (!email) return '익명'
  const [local, domain] = email.split('@')
  if (local.length <= 2) return email
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
}

// 공개 캡슐 불러오기 (내 캡슐 제외)
async function loadPublicCapsules(page = 1) {
  const currentUser = getCurrentUser()

  let query = supabase
    .from('capsules')
    .select(`
      id,
      user_id,
      open_at,
      created_at,
      is_opened,
      users (email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

  if (currentUser) {
    query = query.neq('user_id', currentUser.id)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('공개 캡슐 오류:', error)
    return { capsules: [], total: 0 }
  }

  const capsules = data.map((c: any) => ({
    ...c,
    email: c.users?.email || '익명'
  }))

  return { capsules, total: count || 0 }
}

export async function loadCapsules(publicPage = 1) {
  if (!capsuleList) return

  const currentUser = getCurrentUser()

  // 헤더 사용자 메뉴 업데이트
  const userMenu = document.getElementById('user-menu')
  if (userMenu) {
    if (currentUser) {
      userMenu.innerHTML = `
        <span class="user-email">${currentUser.email}</span>
        <button class="logout-btn" id="logout-btn">로그아웃</button>
      `
      document.getElementById('logout-btn')?.addEventListener('click', () => {
        signOut()
        loadCapsules(publicPage)
        alert('로그아웃되었습니다.')
      })
    } else {
      userMenu.innerHTML = ''
    }
  }

  // 로그인 안 됐으면 로그인 폼 표시
  if (!currentUser) {
    renderLoginForm(capsuleList)
    return
  }

  let html = `
    <section class="public-section fade-in">
      <h2 class="section-title">다른 사람들의 캡슐들</h2>
      <div class="capsule-grid">
  `

  const { capsules: publicCapsules, total: totalPublic } = await loadPublicCapsules(publicPage)

  if (publicCapsules.length === 0) {
    html += '<p class="empty-message">아직 공개된 캡슐이 없어요...</p>'
  } else {
    html += publicCapsules.map(capsule => {
      const maskedEmail = maskEmail(capsule.email)
      const openAtDate = new Date(capsule.open_at)
      const isOpenable = !capsule.is_opened && openAtDate <= new Date()
      const statusClass = capsule.is_opened ? 'unlocked' : 'locked'

      return `
        <div class="capsule-card ${statusClass} hover-scale">
          <div class="card-content">
            <h2 class="card-title">비밀 캡슐</h2>
            <p class="card-author">by ${maskedEmail}</p>
            <p class="card-date">
              ${capsule.is_opened ? '개봉됨' : '열림 예정: ' + openAtDate.toLocaleDateString('ko-KR')}
            </p>
            <p class="card-message">
              ${capsule.is_opened ? '이미 열렸어요!' : isOpenable ? '지금 열 수 있어요!' : '아직 열 수 없습니다...'}
            </p>
          </div>
        </div>
      `
    }).join('')
  }

  html += '</div>'

  // 페이지네이션
  if (totalPublic > ITEMS_PER_PAGE) {
    const totalPages = Math.ceil(totalPublic / ITEMS_PER_PAGE)
    html += '<div class="pagination">'
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === publicPage ? 'active' : ''}" data-page="${i}">${i}</button>`
    }
    html += '</div>'
  }

  html += '<div class="section-divider"></div>'

  // 나의 캡슐 섹션
  html += `
    <section class="my-section fade-in">
      <div class="my-header">
        <h2 class="section-title">나의 캡슐</h2>
        <button id="create-new-btn" class="create-btn">새 캡슐 만들기</button>
      </div>
      <div class="capsule-grid">
  `

  const { data: myCapsules, error: myError } = await supabase
    .from('capsules')
    .select('id, title, open_at, created_at, is_opened, opened_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })

  if (myError) {
    html += '<p class="error-message">나의 캡슐을 불러오는 중 오류가 발생했습니다.</p>'
  } else if (myCapsules.length === 0) {
    html += '<p class="empty-message">아직 만든 캡슐이 없어요. 새 캡슐을 만들어 보세요!</p>'
  } else {
    html += myCapsules.map(capsule => {
      const openAtDate = new Date(capsule.open_at)
      const now = new Date()
      const isOpenable = !capsule.is_opened && openAtDate <= now
      const statusClass = capsule.is_opened ? 'unlocked' : 'locked'

      let dateText = capsule.is_opened
        ? `개봉됨: ${new Date(capsule.opened_at).toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}`
        : `열림 예정: ${openAtDate.toLocaleDateString('ko-KR')}`

      let messageText = capsule.is_opened
        ? '이 캡슐은 이미 열렸습니다!'
        : isOpenable
          ? '지금 열 수 있어요!'
          : '아직 열 수 없습니다...\n조금만 더 기다려주세요.'

      const deleteBtn = !capsule.is_opened
        ? `<button class="delete-btn" data-id="${capsule.id}">삭제</button>`
        : ''

      return `
        <div class="capsule-card ${statusClass} hover-scale" data-id="${capsule.id}">
          <div class="card-content">
            <h2 class="card-title">${capsule.title || '(제목 없음)'}</h2>
            <p class="card-date">${dateText}</p>
            <p class="card-message" style="white-space: pre-line;">${messageText}</p>
            ${isOpenable && !capsule.is_opened
              ? `<button class="open-btn" data-id="${capsule.id}">열기</button>`
              : ''}
            ${deleteBtn}
          </div>
        </div>
      `
    }).join('')
  }

  html += '</div></section>'

  capsuleList.innerHTML = html

  // 애니메이션 지연 적용 (fade-in)
  setTimeout(() => {
    const sections = document.querySelectorAll('.fade-in')
    sections.forEach(s => s.classList.add('visible'))
  }, 100)

  // 이벤트 리스너들
  document.getElementById('create-new-btn')?.addEventListener('click', () => {
    if (capsuleList && currentUser) {
      renderCreateCapsuleForm(capsuleList)
    }
  })

  document.querySelectorAll('.pagination button').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt((btn as HTMLButtonElement).dataset.page || '1')
      loadCapsules(page)
    })
  })

  // 열기 버튼 이벤트
  document.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement
      const id = target.dataset.id

      if (!id) return

      try {
        const currentUser = getCurrentUser()
        if (!currentUser) {
          alert('로그인 후 이용해주세요.')
          return
        }

        const { data: capsule, error: fetchError } = await supabase
          .from('capsules')
          .select('title, content, open_at, created_at, is_opened, opened_at')
          .eq('id', id)
          .eq('user_id', currentUser.id)
          .single()

        if (fetchError || !capsule) {
          alert('캡슐을 불러올 수 없습니다.')
          return
        }

        if (capsule.is_opened) {
          alert('이미 열린 캡슐입니다.')
          return
        }

        const { error: updateError } = await supabase
          .from('capsules')
          .update({
            is_opened: true,
            opened_at: new Date().toISOString()
          })
          .eq('id', id)
          .eq('user_id', currentUser.id)

        if (updateError) {
          alert('개봉 중 오류가 발생했습니다.')
          return
        }

        const decryptedContent = decrypt(capsule.content)

        const modal = document.createElement('div')
        modal.className = 'modal fade-in'
        modal.innerHTML = `
          <div class="modal-content">
            <button id="close-modal" class="close-btn">×</button>
            <h2>${capsule.title || '(제목 없음)'}</h2>
            <div class="modal-message">${decryptedContent}</div>
            <p class="modal-time">
              봉인일: ${new Date(capsule.created_at).toLocaleDateString('ko-KR')} • 
              개봉 시각: ${new Date(capsule.opened_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        `

        document.body.appendChild(modal)

        modal.querySelector('#close-modal')?.addEventListener('click', () => {
          modal.classList.remove('fade-in')
          modal.classList.add('fade-out')
          setTimeout(() => modal.remove(), 400)
          loadCapsules(publicPage)
        })

        modal.addEventListener('click', (ev) => {
          if (ev.target === modal) {
            modal.classList.remove('fade-in')
            modal.classList.add('fade-out')
            setTimeout(() => modal.remove(), 400)
            loadCapsules(publicPage)
          }
        })
      } catch (err) {
        console.error(err)
        alert('오류가 발생했습니다. 다시 시도해주세요.')
      }
    })
  })

  // 삭제 버튼 이벤트
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement
      const id = target.dataset.id

      if (!id) return

      const confirmModal = document.createElement('div')
      confirmModal.className = 'modal fade-in'
      confirmModal.innerHTML = `
        <div class="modal-content confirm-modal">
          <h2 style="color: #ef4444;">정말 삭제하시겠어요?</h2>
          <p style="color: #4b5563; margin: 20px 0;">삭제된 캡슐은 복구할 수 없습니다.</p>
          <div style="display: flex; gap: 20px; justify-content: center;">
            <button id="cancel-delete" class="btn-secondary">취소</button>
            <button id="confirm-delete" class="btn-danger">삭제</button>
          </div>
        </div>
      `

      document.body.appendChild(confirmModal)

      confirmModal.querySelector('#cancel-delete')?.addEventListener('click', () => {
        confirmModal.classList.add('fade-out')
        setTimeout(() => confirmModal.remove(), 400)
      })

      confirmModal.querySelector('#confirm-delete')?.addEventListener('click', async () => {
        try {
          const { error } = await supabase
            .from('capsules')
            .delete()
            .eq('id', id)
            .eq('user_id', currentUser.id)
            .eq('is_opened', false)

          if (error) throw error

          confirmModal.classList.add('fade-out')
          setTimeout(() => confirmModal.remove(), 400)
          alert('캡슐이 삭제되었습니다.')
          loadCapsules(publicPage)
        } catch (err) {
          console.error(err)
          alert('삭제 중 오류가 발생했습니다.')
          confirmModal.remove()
        }
      })
    })
  })
}

// 초기 로드
loadCapsules(1)

// 스토리지 변화 감지
window.addEventListener('storage', (e) => {
  if (e.key === 'capsule_user_id') {
    loadCapsules(1)
  }
})