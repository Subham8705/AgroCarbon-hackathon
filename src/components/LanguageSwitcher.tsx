import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 px-0">
                    <Globe className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
                    <span className="sr-only">Toggle language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                    English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('hi')}>
                    Hindi (हिंदी)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('te')}>
                    Telugu (తెలుగు)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('kn')}>
                    Kannada (ಕನ್ನಡ)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('ur')}>
                    Urdu (اردو)
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
