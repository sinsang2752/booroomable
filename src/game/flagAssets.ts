// 국기 SVG를 flag-icons 패키지 전체 CSS(fi/fi-{code})로 가져오면 Vite가 그 CSS 안의
// url() 참조를 전부(약 250개국) 번들에 넣어버린다 — 실제 쓰는 건 26개뿐이라 여기서
// 정확히 그 26개 파일만 개별 import해서 Vite가 딱 그만큼만 번들하게 한다.
// (유니코드 국기 이모지를 처음 썼는데 Windows에서 그림 대신 빈 상자로 보이는 문제가
// 있어서 실제 SVG 파일 기반인 flag-icons로 교체 — board.ts의 TILE_FLAGS 참고.)
import ae from 'flag-icons/flags/4x3/ae.svg';
import ar from 'flag-icons/flags/4x3/ar.svg';
import au from 'flag-icons/flags/4x3/au.svg';
import br from 'flag-icons/flags/4x3/br.svg';
import ca from 'flag-icons/flags/4x3/ca.svg';
import cz from 'flag-icons/flags/4x3/cz.svg';
import de from 'flag-icons/flags/4x3/de.svg';
import dk from 'flag-icons/flags/4x3/dk.svg';
import es from 'flag-icons/flags/4x3/es.svg';
import fr from 'flag-icons/flags/4x3/fr.svg';
import gb from 'flag-icons/flags/4x3/gb.svg';
import gr from 'flag-icons/flags/4x3/gr.svg';
import id from 'flag-icons/flags/4x3/id.svg';
import it from 'flag-icons/flags/4x3/it.svg';
import jp from 'flag-icons/flags/4x3/jp.svg';
import kr from 'flag-icons/flags/4x3/kr.svg';
import mo from 'flag-icons/flags/4x3/mo.svg';
import my from 'flag-icons/flags/4x3/my.svg';
import ph from 'flag-icons/flags/4x3/ph.svg';
import pl from 'flag-icons/flags/4x3/pl.svg';
import pt from 'flag-icons/flags/4x3/pt.svg';
import se from 'flag-icons/flags/4x3/se.svg';
import th from 'flag-icons/flags/4x3/th.svg';
import tw from 'flag-icons/flags/4x3/tw.svg';
import us from 'flag-icons/flags/4x3/us.svg';
import vn from 'flag-icons/flags/4x3/vn.svg';

/** 국가 코드 -> 국기 SVG 에셋 URL. TILE_FLAGS(board.ts)의 코드와 1:1로 대응해야 한다. */
export const FLAG_ASSET_URLS: Record<string, string> = {
  ae, ar, au, br, ca, cz, de, dk, es, fr, gb, gr, id, it, jp, kr, mo, my, ph, pl, pt, se, th, tw, us, vn,
};
