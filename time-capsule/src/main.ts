// src/main.ts - FutureBox 최종 완성본 (완벽한 모달 디자인 업그레이드)

import { supabase } from './lib/supabase.ts'
import { renderLoginForm } from './components/LoginForm.ts'
import { renderCreateCapsuleForm } from './components/CreateCapsuleForm.ts'
import { getCurrentUser, signOut } from './lib/auth.ts'
import { decrypt } from './lib/crypto.ts'

const capsuleList = document.getElementById('capsule-list') as HTMLDivElement | null
const introSection = document.getElementById('intro-section') as HTMLElement | null
const ITEMS_PER_PAGE = 6

function maskEmail(email: string): string {
  if (!email) return '익명'
  const [local, domain] = email.split('@')
  if (local.length <= 2) return email
  return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`
}

// 공개 상자 불러오기
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
    console.error('공개 상자 오류:', error)
    return { capsules: [], total: 0 }
  }

  const capsules = data.map((c: any) => ({
    ...c,
    email: c.users?.email || '익명'
  }))

  return { capsules, total: count || 0 }
}

export async function loadCapsules(publicPage = 1) {
  if (!capsuleList || !introSection) return

  const currentUser = getCurrentUser()

  // 인트로 섹션 렌더링
  if (!currentUser) {
    introSection.innerHTML = `
      <h2 style="font-size: 1.8rem;">미래의 나에게 메시지를 보내세요</h2>
      <p style="font-size: 1rem; opacity: 0.8;">FutureBox는 당신의 추억을 안전하게 봉인합니다. 지정한 날짜에만 열 수 있어요!</p>
    `
  } else {
    introSection.innerHTML = `
      <h2 style="font-size: 1.8rem;">환영합니다, ${currentUser.email?.split('@')[0] ?? '사용자'}님!</h2>
      <p style="font-size: 1rem; opacity: 0.8;">새로운 상자를 만들거나, 기존 상자를 확인해보세요.</p>
    `
  }

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

  if (!currentUser) {
    renderLoginForm(capsuleList)
    return
  }

  let html = `
    <section class="public-section fade-in">
      <h2 class="section-title">다른 사람들의 상자들</h2>
      <div class="capsule-grid">
  `

  const { capsules: publicCapsules, total: totalPublic } = await loadPublicCapsules(publicPage)

  if (publicCapsules.length === 0) {
    html += '<p class="empty-message">아직 공개된 상자가 없어요...</p>'
  } else {
    html += publicCapsules.map(capsule => {
      const maskedEmail = maskEmail(capsule.email)
      const openAtDate = new Date(capsule.open_at)
      const isOpenable = !capsule.is_opened && openAtDate <= new Date()
      const statusClass = capsule.is_opened ? 'unlocked' : 'locked'

      let messageText = ''
      let messageColor = ''

      if (capsule.is_opened) {
        messageText = '이미 열렸어요!'
        messageColor = '#34d399'
      } else if (isOpenable) {
        messageText = '지금 열 수 있어요!'
        messageColor = '#fbbf24'
      } else {
        messageText = '아직 열 수 없습니다...'
        messageColor = '#9ca3af'
      }

      return `
        <div class="capsule-card ${statusClass} hover-scale">
          <div class="card-content">
            <h2 class="card-title">비밀 상자</h2>
            <p class="card-author">by ${maskedEmail}</p>
            <p class="card-date">
              ${capsule.is_opened ? '개봉됨' : '열림 예정: ' + openAtDate.toLocaleDateString('ko-KR')}
            </p>
            <p class="card-message" style="color: ${messageColor};">
              ${messageText}
            </p>
          </div>
        </div>
      `
    }).join('')
  }

  html += '</div>'

  if (totalPublic > ITEMS_PER_PAGE) {
    const totalPages = Math.ceil(totalPublic / ITEMS_PER_PAGE)
    html += '<div class="pagination">'
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="${i === publicPage ? 'active' : ''}" data-page="${i}">${i}</button>`
    }
    html += '</div>'
  }

  html += '<div class="section-divider"></div>'

  // 나의 상자 섹션
  html += `
    <section class="my-section fade-in">
      <div class="my-header">
        <h2 class="section-title">나의 상자</h2>
        <button id="create-new-btn" class="create-btn">새 상자 만들기</button>
      </div>
      <div class="capsule-grid">
  `

  const { data: myCapsules, error: myError } = await supabase
    .from('capsules')
    .select('id, title, open_at, created_at, is_opened, opened_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })

  if (myError) {
    html += '<p class="error-message">나의 상자를 불러오는 중 오류가 발생했습니다.</p>'
  } else if (myCapsules.length === 0) {
    html += '<p class="empty-message">아직 만든 상자가 없어요. 새 상자를 만들어 보세요!</p>'
  } else {
    html += myCapsules.map(capsule => {
      const openAtDate = new Date(capsule.open_at)
      const now = new Date()
      const isOpenable = !capsule.is_opened && openAtDate <= now
      const statusClass = capsule.is_opened ? 'unlocked' : 'locked'

      let dateText = capsule.is_opened
        ? `개봉됨: ${new Date(capsule.opened_at).toLocaleString('ko-KR', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        })}`
        : `열림 예정: ${openAtDate.toLocaleDateString('ko-KR')}`

      let messageText = ''
      let messageColor = ''

      if (capsule.is_opened) {
        messageText = '이 상자는 이미 열렸습니다!'
        messageColor = '#34d399'
      } else if (isOpenable) {
        messageText = '지금 열 수 있어요!'
        messageColor = '#fbbf24'
      } else {
        messageText = '아직 열 수 없습니다...'
        messageColor = '#9ca3af'
      }

      const openBtn = (capsule.is_opened || isOpenable)
        ? `<button class="open-btn" data-id="${capsule.id}">열기</button>`
        : ''

      const deleteBtn = `<button class="delete-btn" data-id="${capsule.id}">삭제</button>`

      return `
        <div class="capsule-card ${statusClass} hover-scale" data-id="${capsule.id}">
          <div class="card-content">
            <h2 class="card-title">${capsule.title || '(제목 없음)'}</h2>
            <p class="card-date">${dateText}</p>
            <p class="card-message" style="color: ${messageColor};">
              ${messageText}
            </p>
            <div class="button-group">
              ${openBtn}
              ${deleteBtn}
            </div>
          </div>
        </div>
      `
    }).join('')
  }

  html += '</div></section>'

  capsuleList.innerHTML = html

  setTimeout(() => {
    const sections = document.querySelectorAll('.fade-in')
    sections.forEach(s => s.classList.add('visible'))
  }, 100)

  // 만들기 버튼
  document.getElementById('create-new-btn')?.addEventListener('click', () => {
    if (capsuleList && currentUser) {
      renderCreateCapsuleForm(capsuleList)
    }
  })

  // 페이지네이션
  document.querySelectorAll('.pagination button').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt((btn as HTMLButtonElement).dataset.page || '1')
      loadCapsules(page)
    })
  })

  // 열기 버튼 이벤트 (완벽한 디자인의 모달 적용)
  document.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement
      const id = target.dataset.id
      if (!id || !currentUser) return

      const originalText = target.innerText
      target.innerText = '열기 중...'
      target.disabled = true

      try {
        const { data: capsule, error: fetchError } = await supabase
          .from('capsules')
          .select('title, content, open_at, created_at, is_opened, opened_at')
          .eq('id', id)
          .single()

        if (fetchError || !capsule) throw new Error('데이터 로드 실패')

        if (!capsule.is_opened) {
          await supabase
            .from('capsules')
            .update({ is_opened: true, opened_at: new Date().toISOString() })
            .eq('id', id)
        }

        const decryptedContent = decrypt(capsule.content)

        // ==================================================================================
        //  ✨ 완벽하게 업그레이드된 모달 HTML 구조 ✨
        // ==================================================================================
        const modal = document.createElement('div')
        modal.className = 'modal-overlay active' // 새로운 오버레이 클래스 사용
        modal.innerHTML = `
          <div class="future-capsule-modal fade-up">
            <div class="capsule-header">
              <h2 class="capsule-title neon-text">${capsule.title || '무제 캡슐'}</h2>
              <button id="close-modal" class="capsule-close-btn">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="capsule-body-container">
              <div class="hologram-message">
                ${decryptedContent}
              </div>
            </div>
            
            <div class="capsule-footer">
              <span class="meta-info">🔒 봉인: ${new Date(capsule.created_at).toLocaleDateString()}</span>
              <span class="meta-divider">|</span>
              <span class="meta-info open-time">🔓 개봉: ${new Date().toLocaleString()}</span>
            </div>
          </div>
        `
        // ==================================================================================

        document.body.appendChild(modal)
        document.body.style.overflow = 'hidden'

        const closeModal = () => {
          // 닫기 애니메이션을 위해 클래스 교체
          const modalContainer = modal.querySelector('.future-capsule-modal')
          if (modalContainer) {
            modalContainer.classList.remove('fade-up')
            modalContainer.classList.add('fade-down')
          }
          modal.classList.remove('active')
          
          setTimeout(() => {
            modal.remove()
            document.body.style.overflow = 'auto'
            loadCapsules(publicPage)
          }, 0) // 애니메이션 시간만큼 대기
        }

        modal.querySelector('#close-modal')?.addEventListener('click', closeModal)
        modal.addEventListener('click', (ev) => { 
          if (ev.target === modal) closeModal() 
        })

      } catch (err) {
        console.error(err)
        alert('상자를 여는 데 실패했습니다.')
      } finally {
        target.innerText = originalText
        target.disabled = false
      }
    })
  })

  // 삭제 버튼 이벤트
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement
      const id = target.dataset.id
      if (!id || !confirm('정말 삭제하시겠어요? 복구할 수 없습니다.')) return

      try {
        const { error } = await supabase.from('capsules').delete().eq('id', id)
        if (error) throw error
        alert('삭제되었습니다.')
        loadCapsules(publicPage)
      } catch (err) {
        alert('삭제 중 오류가 발생했습니다.')
      }
    })
  })
}

loadCapsules(1)
window.addEventListener('storage', (e) => {
  if (e.key === 'capsule_user_id') loadCapsules(1)
})